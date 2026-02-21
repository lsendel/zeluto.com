import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import {
  findSeedTestById,
  findSeedTestsByOrg,
  findSeedTestsByWindow,
  insertSeedTest,
  updateSeedTest,
} from '../infrastructure/repositories/seed-test-repository.js';
import { deliverabilityRoutes } from './deliverability-routes.js';

vi.mock('../infrastructure/repositories/seed-test-repository.js', () => ({
  findSeedTestById: vi.fn(),
  findSeedTestsByOrg: vi.fn(),
  findSeedTestsByWindow: vi.fn(),
  insertSeedTest: vi.fn(),
  updateSeedTest: vi.fn(),
}));

function createTestApp() {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  app.use('/api/v1/delivery/*', async (c, next) => {
    c.set('tenant', {
      organizationId: '11111111-1111-4111-8111-111111111111' as never,
      userId: '22222222-2222-4222-8222-222222222222' as never,
      userRole: 'owner',
      plan: 'enterprise',
    });
    c.set('db', {} as never);
    await next();
  });
  app.route('/', deliverabilityRoutes);
  return app;
}

function baseEnv(overrides?: Partial<Env['Bindings']>): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: {} as KVNamespace,
    EVENTS: { send: vi.fn() } as unknown as Queue,
    ENCRYPTION_KEY: 'test-key',
    ...overrides,
  };
}

function buildSeedTestRow(overrides?: Record<string, unknown>) {
  return {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    organization_id: '11111111-1111-4111-8111-111111111111',
    sending_domain_id: null,
    subject_line: 'Test subject',
    html_body: '<p>Hello</p>',
    from_address: 'sender@example.com',
    status: 'completed',
    results: [
      { seedAddress: 'a@gmail.com', provider: 'gmail', placement: 'inbox', receivedAt: '2026-02-10T00:30:00.000Z', headers: {} },
      { seedAddress: 'b@outlook.com', provider: 'outlook', placement: 'spam', receivedAt: '2026-02-10T00:30:00.000Z', headers: {} },
      { seedAddress: 'c@yahoo.com', provider: 'yahoo', placement: 'inbox', receivedAt: '2026-02-10T00:30:00.000Z', headers: {} },
      { seedAddress: 'd@gmail.com', provider: 'gmail', placement: 'missing', receivedAt: null, headers: null },
    ],
    inbox_rate: '50.00',
    spam_rate: '25.00',
    missing_rate: '25.00',
    started_at: new Date('2026-02-10T00:00:00.000Z'),
    completed_at: new Date('2026-02-10T01:00:00.000Z'),
    created_at: new Date('2026-02-10T00:00:00.000Z'),
    ...overrides,
  };
}

describe('deliverability routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Inbox Placement ──────────────────────────────────

  describe('GET /api/v1/delivery/diagnostics/inbox-placement', () => {
    it('returns aggregated placement report by provider', async () => {
      vi.mocked(findSeedTestsByWindow).mockResolvedValue([
        buildSeedTestRow(),
      ] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/diagnostics/inbox-placement?days=30&now=2026-02-20T00:00:00.000Z',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        period: { days: number };
        totals: { inbox: number; spam: number; missing: number; completed: number };
        providers: Array<{ provider: string; inbox: number }>;
      }>();

      expect(body.period.days).toBe(30);
      expect(body.totals.completed).toBe(4);
      expect(body.totals.inbox).toBe(2);
      expect(body.totals.spam).toBe(1);
      expect(body.totals.missing).toBe(1);
      expect(body.providers.length).toBe(3);
    });

    it('returns empty report when no seed tests exist', async () => {
      vi.mocked(findSeedTestsByWindow).mockResolvedValue([]);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/diagnostics/inbox-placement?now=2026-02-20T00:00:00.000Z',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        totals: { completed: number; inboxRate: number };
      }>();
      expect(body.totals.completed).toBe(0);
      expect(body.totals.inboxRate).toBe(0);
    });

    it('returns 400 for invalid now parameter', async () => {
      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/diagnostics/inbox-placement?now=not-a-date',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid now query parameter',
      });
    });
  });

  // ── Provider Trend ──────────────────────────────────

  describe('GET /api/v1/delivery/diagnostics/providers/trend', () => {
    it('returns period-over-period provider trend comparison', async () => {
      const currentRow = buildSeedTestRow();
      const previousRow = buildSeedTestRow({
        id: 'bbbb2222-2222-4222-8222-222222222222',
        results: [
          { seedAddress: 'a@gmail.com', provider: 'gmail', placement: 'inbox', receivedAt: '2026-01-15T00:30:00.000Z', headers: {} },
          { seedAddress: 'b@gmail.com', provider: 'gmail', placement: 'inbox', receivedAt: '2026-01-15T00:30:00.000Z', headers: {} },
        ],
        created_at: new Date('2026-01-15T00:00:00.000Z'),
      });

      vi.mocked(findSeedTestsByWindow)
        .mockResolvedValueOnce([currentRow] as never)
        .mockResolvedValueOnce([previousRow] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/diagnostics/providers/trend?days=30&now=2026-02-20T00:00:00.000Z',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        period: { days: number };
        totals: { current: { completed: number }; previous: { completed: number } };
        providers: Array<{ provider: string; delta: { inboxRate: number } }>;
      }>();

      expect(body.period.days).toBe(30);
      expect(body.totals.current.completed).toBe(4);
      expect(body.totals.previous.completed).toBe(2);
      expect(body.providers.length).toBeGreaterThan(0);

      const gmailTrend = body.providers.find((p) => p.provider === 'gmail');
      expect(gmailTrend).toBeDefined();
      // Current gmail: 1 inbox + 1 missing = 50% inbox; Previous gmail: 2 inbox = 100% inbox → delta = -50
      expect(gmailTrend!.delta.inboxRate).toBe(-50);
    });

    it('handles missing previous period gracefully', async () => {
      vi.mocked(findSeedTestsByWindow)
        .mockResolvedValueOnce([buildSeedTestRow()] as never)
        .mockResolvedValueOnce([] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/diagnostics/providers/trend?days=7&now=2026-02-20T00:00:00.000Z',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        totals: { previous: { completed: number } };
      }>();
      expect(body.totals.previous.completed).toBe(0);
    });
  });

  // ── Seed Test CRUD ──────────────────────────────────

  describe('POST /api/v1/delivery/seed-tests', () => {
    it('creates a seed test and enqueues event', async () => {
      vi.mocked(insertSeedTest).mockResolvedValue(buildSeedTestRow() as never);

      const app = createTestApp();
      const env = baseEnv();
      const response = await app.request(
        'http://localhost/api/v1/delivery/seed-tests',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectLine: 'Test',
            htmlBody: '<p>Hi</p>',
            fromAddress: 'test@example.com',
            seedAddresses: [{ address: 'seed@gmail.com', provider: 'gmail' }],
          }),
        },
        env,
      );

      expect(response.status).toBe(201);
      expect(insertSeedTest).toHaveBeenCalledOnce();
      expect(env.EVENTS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'delivery.SeedTestStarted' }),
      );
    });

    it('returns 400 when seed addresses are missing', async () => {
      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/seed-tests',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectLine: 'Test',
            htmlBody: '<p>Hi</p>',
            fromAddress: 'test@example.com',
            seedAddresses: [],
          }),
        },
        baseEnv(),
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/delivery/seed-tests', () => {
    it('lists seed tests for the organization', async () => {
      vi.mocked(findSeedTestsByOrg).mockResolvedValue([
        buildSeedTestRow(),
      ] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/seed-tests?limit=10',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{ data: unknown[] }>();
      expect(body.data).toHaveLength(1);
      expect(findSeedTestsByOrg).toHaveBeenCalledWith(
        {},
        '11111111-1111-4111-8111-111111111111',
        { limit: 10 },
      );
    });
  });

  describe('GET /api/v1/delivery/seed-tests/:id', () => {
    it('returns 404 when seed test not found', async () => {
      vi.mocked(findSeedTestById).mockResolvedValue(null);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/delivery/seed-tests/nonexistent',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(404);
    });
  });
});