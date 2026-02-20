import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import {
  createActivity,
  findActivitiesByDeal,
} from '../infrastructure/repositories/activity-repository.js';
import { findDealById } from '../infrastructure/repositories/deal-repository.js';
import { agentRoutes } from './agent-routes.js';

vi.mock('../infrastructure/repositories/deal-repository.js', () => ({
  findDealById: vi.fn(),
}));

vi.mock('../infrastructure/repositories/activity-repository.js', () => ({
  findActivitiesByDeal: vi.fn(),
  createActivity: vi.fn(),
}));

function createAgentApp() {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  app.use('/api/v1/revops/*', async (c, next) => {
    c.set('tenant', {
      organizationId: '11111111-1111-4111-8111-111111111111' as never,
      userId: '22222222-2222-4222-8222-222222222222' as never,
      userRole: 'owner',
      plan: 'enterprise',
    });
    c.set('db', {} as never);
    await next();
  });
  app.route('/', agentRoutes);
  return app;
}

function baseEnv(overrides?: Partial<Env['Bindings']>): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: {} as KVNamespace,
    EVENTS: {} as Queue,
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    ...overrides,
  };
}

describe('agent routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createActivity).mockResolvedValue({} as never);
  });

  it('returns deterministic next-best-action recommendation', async () => {
    vi.mocked(findDealById).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      organization_id: '11111111-1111-4111-8111-111111111111',
      account_id: null,
      contact_id: '44444444-4444-4444-8444-444444444444',
      name: 'Expansion Deal',
      stage: 'proposal',
      value: '70000.00',
      probability: 60,
      priority: 'high',
      assigned_rep: '55555555-5555-4555-8555-555555555555',
      expected_close_at: null,
      closed_at: null,
      lost_reason: null,
      notes: null,
      metadata: null,
      created_at: new Date('2026-02-01T00:00:00.000Z'),
      updated_at: new Date('2026-02-01T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findDealById>>);
    vi.mocked(findActivitiesByDeal).mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        organization_id: '11111111-1111-4111-8111-111111111111',
        type: 'email',
        contact_id: '44444444-4444-4444-8444-444444444444',
        deal_id: '33333333-3333-4333-8333-333333333333',
        outcome: null,
        duration_minutes: null,
        notes: null,
        scheduled_at: null,
        completed_at: null,
        created_by: null,
        created_at: new Date('2026-02-01T00:00:00.000Z'),
      },
    ] as Awaited<ReturnType<typeof findActivitiesByDeal>>);

    const app = createAgentApp();
    const response = await app.request(
      'http://localhost/api/v1/revops/agents/next-best-action/33333333-3333-4333-8333-333333333333?now=2026-03-01T00:00:00.000Z',
      undefined,
      baseEnv(),
    );

    expect(response.status).toBe(200);
    expect(findDealById).toHaveBeenCalledWith(
      {},
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    );
    const payload = await response.json<{
      action: { type: string; priority: string };
      risk: { level: string };
      explainability: { confidence: number };
    }>();
    expect(payload.action.type).toBe('rescue_call');
    expect(payload.action.priority).toBe('urgent');
    expect(payload.risk.level).toBe('at_risk');
    expect(payload.explainability.confidence).toBeGreaterThan(0);
  });

  it('returns explainability trail for inspector analysis', async () => {
    vi.mocked(findDealById).mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      organization_id: '11111111-1111-4111-8111-111111111111',
      account_id: null,
      contact_id: '88888888-8888-4888-8888-888888888888',
      name: 'Pipeline Deal',
      stage: 'qualification',
      value: '20000.00',
      probability: 20,
      priority: 'medium',
      assigned_rep: null,
      expected_close_at: null,
      closed_at: null,
      lost_reason: null,
      notes: null,
      metadata: null,
      created_at: new Date('2026-02-10T00:00:00.000Z'),
      updated_at: new Date('2026-02-18T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findDealById>>);
    vi.mocked(findActivitiesByDeal).mockResolvedValue([
      {
        id: '99999999-9999-4999-8999-999999999999',
        organization_id: '11111111-1111-4111-8111-111111111111',
        type: 'meeting',
        contact_id: '88888888-8888-4888-8888-888888888888',
        deal_id: '77777777-7777-4777-8777-777777777777',
        outcome: null,
        duration_minutes: 30,
        notes: null,
        scheduled_at: null,
        completed_at: null,
        created_by: null,
        created_at: new Date('2026-02-19T00:00:00.000Z'),
      },
    ] as Awaited<ReturnType<typeof findActivitiesByDeal>>);

    const app = createAgentApp();
    const response = await app.request(
      'http://localhost/api/v1/revops/agents/deal-inspector/77777777-7777-4777-8777-777777777777/explainability?now=2026-02-20T00:00:00.000Z',
      undefined,
      baseEnv(),
    );

    expect(response.status).toBe(200);
    const payload = await response.json<{
      report: { riskLevel: string };
      explainability: { summary: string; signals: unknown[] };
    }>();
    expect(payload.report.riskLevel).toBe('healthy');
    expect(payload.explainability.summary.length).toBeGreaterThan(0);
    expect(payload.explainability.signals.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid now parameter', async () => {
    const app = createAgentApp();
    const response = await app.request(
      'http://localhost/api/v1/revops/agents/next-best-action/33333333-3333-4333-8333-333333333333?now=not-a-date',
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
