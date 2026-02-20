import type { TenantContext } from '@mauntic/domain-kernel';
import { createDatabase } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import { queryEvents } from '../infrastructure/repositories/event-repository.js';
import { analyticsDispatchRoutes } from './dispatch-routes.js';
import { eventRoutes } from './event-routes.js';

vi.mock('@mauntic/worker-lib', () => ({
  createDatabase: vi.fn(),
  tenantMiddleware: vi.fn(
    () =>
      async (
        c: { set: (key: string, value: unknown) => void },
        next: () => Promise<void>,
      ) => {
        c.set('tenant', {
          organizationId: 'org-1',
          userId: 'user-1',
          userRole: 'owner',
          plan: 'pro',
        } as TenantContext);
        await next();
      },
  ),
}));

vi.mock('../infrastructure/repositories/event-repository.js', () => ({
  logEvent: vi.fn(),
  queryAggregates: vi.fn(),
  queryEvents: vi.fn(),
}));

function createPublicApp(db: NeonHttpDatabase): Hono<Env> {
  const app = new Hono<Env>();
  app.use('/api/*', async (c, next) => {
    c.set('db', db);
    c.set('tenant', {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'owner',
      plan: 'pro',
    } as TenantContext);
    await next();
  });
  app.route('/', eventRoutes);
  return app;
}

function createDispatchApp(db: NeonHttpDatabase): Hono<Env> {
  vi.mocked(createDatabase).mockReturnValue(db as never);
  const app = new Hono<Env>();
  app.route('/__dispatch/analytics', analyticsDispatchRoutes);
  return app;
}

function createEnv(): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: {} as KVNamespace,
    EVENTS: {} as Queue,
  };
}

describe('timeline parity guard', () => {
  const db = {} as NeonHttpDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps public and dispatch timeline payloads identical for same input', async () => {
    vi.mocked(queryEvents).mockResolvedValue({
      total: 3,
      data: [
        {
          id: 'evt-1',
          organizationId: 'org-1',
          contactId: 'contact-1',
          eventType: 'delivery.MessageOpened',
          eventSource: 'delivery:webhook',
          eventData: { channel: 'email' },
          createdAt: new Date('2026-02-20T10:00:10.000Z'),
        },
        {
          id: 'evt-2',
          organizationId: 'org-1',
          contactId: 'contact-1',
          eventType: 'delivery.MessageOpened',
          eventSource: 'delivery:webhook',
          eventData: { channel: 'email' },
          createdAt: new Date('2026-02-20T10:00:30.000Z'),
        },
        {
          id: 'evt-3',
          organizationId: 'org-1',
          contactId: 'contact-1',
          eventType: 'journey.StepExecuted',
          eventSource: 'journey',
          eventData: null,
          createdAt: new Date('2026-02-20T10:01:00.000Z'),
        },
      ],
    });

    const publicApp = createPublicApp(db);
    const dispatchApp = createDispatchApp(db);
    const env = createEnv();

    const publicResponse = await publicApp.request(
      'http://localhost/api/v1/analytics/contacts/contact-1/timeline?page=1&limit=50&startDate=2026-02-20T00:00:00.000Z&endDate=2026-02-21T00:00:00.000Z',
    );
    const dispatchResponse = await dispatchApp.request(
      'http://localhost/__dispatch/analytics/events/timeline',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: 'contact-1',
          page: 1,
          limit: 50,
          startDate: '2026-02-20T00:00:00.000Z',
          endDate: '2026-02-21T00:00:00.000Z',
        }),
      },
      env,
    );

    expect(publicResponse.status).toBe(200);
    expect(dispatchResponse.status).toBe(200);

    const publicPayload = await publicResponse.json<{
      data: Array<{ eventType: string; category: string; count: number }>;
      total: number;
      consolidatedCount: number;
      page: number;
      limit: number;
      totalPages: number;
    }>();
    const dispatchPayload = await dispatchResponse.json<{
      data: Array<{ eventType: string; category: string; count: number }>;
      total: number;
      consolidatedCount: number;
      page: number;
      limit: number;
      totalPages: number;
    }>();

    expect(publicPayload).toEqual(dispatchPayload);
    expect(publicPayload).toEqual(
      expect.objectContaining({
        total: 3,
        consolidatedCount: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      }),
    );
    expect(publicPayload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'journey.StepExecuted',
          category: 'journey',
          count: 1,
        }),
        expect.objectContaining({
          eventType: 'delivery.MessageOpened',
          category: 'delivery',
          count: 2,
        }),
      ]),
    );
  });
});
