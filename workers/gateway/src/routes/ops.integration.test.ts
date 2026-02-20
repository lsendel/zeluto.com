import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index.js';
import { createOpsRoutes } from './ops.js';

/**
 * Create a mock Fetcher that returns a given status from /health.
 */
function mockFetcher(healthStatus: number): Fetcher {
  return {
    fetch: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: healthStatus,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
    connect: vi.fn() as any,
  } as unknown as Fetcher;
}

/**
 * Create a mock Fetcher that throws (simulating unreachable service).
 */
function unreachableFetcher(): Fetcher {
  return {
    fetch: vi.fn().mockRejectedValue(new Error('Connection refused')),
    connect: vi.fn() as any,
  } as unknown as Fetcher;
}

function createTestApp(envOverrides?: Partial<Env['Bindings']>) {
  const app = new Hono<Env>();

  app.use('/api/v1/ops/*', async (c, next) => {
    c.set('user', {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'admin@zeluto.com',
      name: 'Admin',
    } as any);
    await next();
  });

  app.route('/api/v1/ops', createOpsRoutes());
  return { app, env: buildEnv(envOverrides) };
}

function buildEnv(overrides?: Partial<Env['Bindings']>): Env['Bindings'] {
  return {
    KV: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    } as unknown as KVNamespace,
    DB: {} as any,
    APP_DOMAIN: 'zeluto.com',
    RATE_LIMITER: {} as any,
    TENANT_CACHE: {} as any,
    IDENTITY: mockFetcher(200),
    BILLING: mockFetcher(200),
    CRM: mockFetcher(200),
    DELIVERY: mockFetcher(200),
    CAMPAIGN: mockFetcher(200),
    JOURNEY: mockFetcher(200),
    CONTENT: mockFetcher(200),
    ANALYTICS: mockFetcher(200),
    INTEGRATIONS: mockFetcher(200),
    LEAD_INTELLIGENCE: mockFetcher(200),
    SCORING: mockFetcher(200),
    REVOPS: mockFetcher(200),
    ...overrides,
  };
}

describe('ops routes', () => {
  describe('GET /api/v1/ops/release-readiness', () => {
    it('returns ready when all services are healthy', async () => {
      const { app, env } = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/ops/release-readiness',
        undefined,
        env,
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        verdict: string;
        summary: { total: number; healthy: number; unreachable: number };
        services: Array<{ name: string; status: string }>;
      }>();

      expect(body.verdict).toBe('ready');
      expect(body.summary.total).toBe(12);
      expect(body.summary.healthy).toBe(12);
      expect(body.summary.unreachable).toBe(0);
      expect(body.services.every((s) => s.status === 'healthy')).toBe(true);
    });

    it('returns blocked when a service is unreachable', async () => {
      const { app, env } = createTestApp({
        DELIVERY: unreachableFetcher(),
      });
      const response = await app.request(
        'http://localhost/api/v1/ops/release-readiness',
        undefined,
        env,
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        verdict: string;
        summary: { unreachable: number };
        services: Array<{ name: string; status: string }>;
      }>();

      expect(body.verdict).toBe('blocked');
      expect(body.summary.unreachable).toBe(1);

      const delivery = body.services.find((s) => s.name === 'delivery');
      expect(delivery?.status).toBe('unreachable');
    });

    it('returns degraded when a service returns non-200', async () => {
      const { app, env } = createTestApp({
        ANALYTICS: mockFetcher(503),
      });
      const response = await app.request(
        'http://localhost/api/v1/ops/release-readiness',
        undefined,
        env,
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        verdict: string;
        summary: { degraded: number };
      }>();

      expect(body.verdict).toBe('degraded');
      expect(body.summary.degraded).toBe(1);
    });
  });

  describe('POST /api/v1/ops/rollback-drill', () => {
    it('returns pass when all services healthy', async () => {
      const { app, env } = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/ops/rollback-drill',
        { method: 'POST' },
        env,
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        drillId: string;
        outcome: string;
        durationMs: number;
        services: Array<{ name: string; latencyMs: number }>;
      }>();

      expect(body.outcome).toBe('pass');
      expect(body.drillId).toBeDefined();
      expect(body.durationMs).toBeGreaterThanOrEqual(0);
      expect(body.services.every((s) => typeof s.latencyMs === 'number')).toBe(
        true,
      );

      // Verify drill result persisted to KV
      expect(env.KV.put).toHaveBeenCalledWith(
        expect.stringContaining('ops:rollback-drill:'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) }),
      );
    });

    it('returns 503 when a service fails during drill', async () => {
      const { app, env } = createTestApp({
        CRM: unreachableFetcher(),
      });
      const response = await app.request(
        'http://localhost/api/v1/ops/rollback-drill',
        { method: 'POST' },
        env,
      );

      expect(response.status).toBe(503);
      const body = await response.json<{
        outcome: string;
        services: Array<{ name: string; status: string }>;
      }>();

      expect(body.outcome).toBe('fail');
      const crm = body.services.find((s) => s.name === 'crm');
      expect(crm?.status).toBe('unreachable');
    });
  });
});
