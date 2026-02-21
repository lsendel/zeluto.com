import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import { dlqRoutes } from './dlq-routes.js';

function createMockKV(store: Map<string, string> = new Map()): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (opts?: { prefix?: string; limit?: number }) => {
      const prefix = opts?.prefix ?? '';
      const limit = opts?.limit ?? 50;
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: '' };
    }),
  } as unknown as KVNamespace;
}

function createTestApp(kv: KVNamespace, queue?: Queue) {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  app.use('/api/*', async (c, next) => {
    c.set('tenant', {} as never);
    c.set('db', {} as never);
    await next();
  });
  app.route('/', dlqRoutes);
  return { app, kv, queue };
}

function baseEnv(kv: KVNamespace, queue?: Queue): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: kv,
    EVENTS: queue ?? ({ send: vi.fn() } as unknown as Queue),
  };
}

describe('DLQ routes', () => {
  let kvStore: Map<string, string>;

  beforeEach(() => {
    kvStore = new Map();
  });

  describe('GET /api/v1/scoring/dlq', () => {
    it('returns empty list when no DLQ entries exist', async () => {
      const kv = createMockKV(kvStore);
      const { app } = createTestApp(kv);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq',
        { method: 'GET' },
        baseEnv(kv),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.entries).toEqual([]);
      expect(body.cursor).toBeNull();
    });

    it('returns DLQ entries from KV', async () => {
      const entry = {
        id: 'aaa-111',
        type: 'scoring.CalculateScore',
        payload: { type: 'scoring.CalculateScore', data: {} },
        error: 'db timeout',
        attempts: 3,
        failedAt: '2026-02-20T10:00:00.000Z',
      };
      kvStore.set('dlq:aaa-111', JSON.stringify(entry));
      const kv = createMockKV(kvStore);
      const { app } = createTestApp(kv);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq',
        { method: 'GET' },
        baseEnv(kv),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      const entries = body.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('aaa-111');
      expect(entries[0].error).toBe('db timeout');
    });
  });

  describe('POST /api/v1/scoring/dlq/:id/replay', () => {
    it('re-enqueues the message and removes from DLQ', async () => {
      const payload = {
        type: 'scoring.CalculateScore',
        data: { organizationId: 'org-1', contactId: 'c-1' },
      };
      const entry = {
        id: 'bbb-222',
        type: 'scoring.CalculateScore',
        payload,
        error: 'timeout',
        attempts: 3,
        failedAt: '2026-02-20T10:00:00.000Z',
      };
      kvStore.set('dlq:bbb-222', JSON.stringify(entry));
      const kv = createMockKV(kvStore);
      const queue = { send: vi.fn() } as unknown as Queue;
      const { app } = createTestApp(kv, queue);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq/bbb-222/replay',
        { method: 'POST' },
        baseEnv(kv, queue),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.message).toBe('Message replayed');
      expect(queue.send).toHaveBeenCalledWith(payload);
      expect(kv.delete).toHaveBeenCalledWith('dlq:bbb-222');
    });

    it('returns 404 for non-existent DLQ entry', async () => {
      const kv = createMockKV(kvStore);
      const { app } = createTestApp(kv);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq/missing-id/replay',
        { method: 'POST' },
        baseEnv(kv),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/scoring/dlq/:id', () => {
    it('discards a DLQ entry', async () => {
      kvStore.set(
        'dlq:ccc-333',
        JSON.stringify({
          id: 'ccc-333',
          type: 'scoring.BatchRecompute',
          payload: {},
          error: 'err',
          attempts: 3,
          failedAt: '2026-02-20T10:00:00.000Z',
        }),
      );
      const kv = createMockKV(kvStore);
      const { app } = createTestApp(kv);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq/ccc-333',
        { method: 'DELETE' },
        baseEnv(kv),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.message).toBe('DLQ entry discarded');
      expect(kv.delete).toHaveBeenCalledWith('dlq:ccc-333');
    });

    it('returns 404 for non-existent DLQ entry', async () => {
      const kv = createMockKV(kvStore);
      const { app } = createTestApp(kv);

      const response = await app.request(
        'http://localhost/api/v1/scoring/dlq/nope',
        { method: 'DELETE' },
        baseEnv(kv),
      );

      expect(response.status).toBe(404);
    });
  });
});
