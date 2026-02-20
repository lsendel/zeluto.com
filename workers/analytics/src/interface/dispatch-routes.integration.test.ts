import type { TenantContext } from '@mauntic/domain-kernel';
import { createDatabase } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import { runTypedReport } from '../application/report-runner.js';
import {
  getOverviewKpis,
  getOverviewStats,
} from '../infrastructure/repositories/dashboard-repository.js';
import { queryEvents } from '../infrastructure/repositories/event-repository.js';
import {
  getAttributionModel,
  getFunnelModel,
} from '../infrastructure/repositories/funnel-attribution-repository.js';
import {
  findReportById,
  updateReport,
} from '../infrastructure/repositories/report-repository.js';
import { analyticsDispatchRoutes } from './dispatch-routes.js';

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

vi.mock('../infrastructure/repositories/dashboard-repository.js', () => ({
  getOverviewKpis: vi.fn(),
  getOverviewStats: vi.fn(),
  getCampaignStats: vi.fn(),
  getJourneyStats: vi.fn(),
}));

vi.mock(
  '../infrastructure/repositories/funnel-attribution-repository.js',
  () => ({
    getFunnelModel: vi.fn(),
    getAttributionModel: vi.fn(),
  }),
);

vi.mock('../application/report-runner.js', () => ({
  runTypedReport: vi.fn(),
}));

vi.mock('../infrastructure/repositories/report-repository.js', () => ({
  createReport: vi.fn(),
  deleteReport: vi.fn(),
  findAllReports: vi.fn(),
  findReportById: vi.fn(),
  updateReport: vi.fn(),
}));

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

describe('analytics dispatch routes parity', () => {
  const db = {} as NeonHttpDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns consolidated contact timeline payload for /events/timeline', async () => {
    vi.mocked(queryEvents).mockResolvedValue({
      total: 5,
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
          createdAt: new Date('2026-02-20T10:00:40.000Z'),
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

    const app = createDispatchApp(db);
    const response = await app.request(
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
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(queryEvents).toHaveBeenCalledWith(db, 'org-1', {
      page: 1,
      limit: 50,
      contactId: 'contact-1',
      startDate: '2026-02-20T00:00:00.000Z',
      endDate: '2026-02-21T00:00:00.000Z',
    });

    const payload = await response.json<{
      total: number;
      pageCount: number;
      consolidatedCount: number;
      page: number;
      limit: number;
      totalPages: number;
      data: Array<{ eventType: string; category: string; count: number }>;
    }>();

    expect(payload.total).toBe(5);
    expect(payload.pageCount).toBe(3);
    expect(payload.consolidatedCount).toBe(2);
    expect(payload.page).toBe(1);
    expect(payload.limit).toBe(50);
    expect(payload.totalPages).toBe(1);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        eventType: 'journey.StepExecuted',
        category: 'journey',
        count: 1,
      }),
    );
    expect(payload.data[1]).toEqual(
      expect.objectContaining({
        eventType: 'delivery.MessageOpened',
        category: 'delivery',
        count: 2,
      }),
    );
  });

  it('returns overview read-model payload for /overview', async () => {
    vi.mocked(getOverviewStats).mockResolvedValue({
      aggregates: [
        {
          id: 'agg-1',
          organizationId: 'org-1',
          date: '2026-02-20',
          eventType: 'email_sent',
          channel: null,
          count: 10,
          uniqueCount: 9,
        },
        {
          id: 'agg-2',
          organizationId: 'org-1',
          date: '2026-02-20',
          eventType: 'email_opened',
          channel: null,
          count: 6,
          uniqueCount: 6,
        },
        {
          id: 'agg-3',
          organizationId: 'org-1',
          date: '2026-02-20',
          eventType: 'email_clicked',
          channel: null,
          count: 2,
          uniqueCount: 2,
        },
        {
          id: 'agg-4',
          organizationId: 'org-1',
          date: '2026-02-20',
          eventType: 'conversion',
          channel: null,
          count: 1,
          uniqueCount: 1,
        },
      ],
      recentActivity: [
        {
          id: 'evt-overview-1',
          organizationId: 'org-1',
          contactId: 'contact-1',
          eventType: 'email_opened',
          eventSource: 'campaign:welcome',
          eventData: {},
          createdAt: new Date('2026-02-20T09:00:00.000Z'),
        },
      ],
    });
    vi.mocked(getOverviewKpis).mockResolvedValue({
      totalContacts: 45,
      activeJourneys: 3,
      campaignsSent: 7,
    });

    const app = createDispatchApp(db);
    const env = createEnv();
    const response = await app.request(
      'http://localhost/__dispatch/analytics/overview',
      { method: 'POST' },
      env,
    );

    expect(response.status).toBe(200);
    expect(getOverviewStats).toHaveBeenCalledWith(db, 'org-1');

    const payload = await response.json<{
      totalContacts: number;
      activeJourneys: number;
      campaignsSent: number;
      emailsSentToday: number;
      openRate: number;
      clickRate: number;
      conversionRate: number;
    }>();

    expect(payload).toEqual(
      expect.objectContaining({
        totalContacts: 45,
        activeJourneys: 3,
        campaignsSent: 7,
        emailsSentToday: 10,
        openRate: 60,
        clickRate: 20,
        conversionRate: 10,
      }),
    );
  });

  it('returns funnel payload parity for /funnel', async () => {
    vi.mocked(getFunnelModel).mockResolvedValue({
      steps: [
        {
          step: 'email_sent',
          totalEvents: 100,
          uniqueContacts: 100,
          conversionFromPrevious: 100,
        },
        {
          step: 'email_opened',
          totalEvents: 60,
          uniqueContacts: 55,
          conversionFromPrevious: 55,
        },
      ],
    });

    const app = createDispatchApp(db);
    const response = await app.request(
      'http://localhost/__dispatch/analytics/funnel',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: ['email_sent', 'email_opened'],
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-02-20T23:59:59.000Z',
        }),
      },
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(getFunnelModel).toHaveBeenCalledWith(db, 'org-1', {
      steps: ['email_sent', 'email_opened'],
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-02-20T23:59:59.000Z',
    });
    await expect(response.json()).resolves.toEqual({
      steps: [
        {
          step: 'email_sent',
          totalEvents: 100,
          uniqueContacts: 100,
          conversionFromPrevious: 100,
        },
        {
          step: 'email_opened',
          totalEvents: 60,
          uniqueContacts: 55,
          conversionFromPrevious: 55,
        },
      ],
    });
  });

  it('returns attribution payload parity for /attribution', async () => {
    vi.mocked(getAttributionModel).mockResolvedValue({
      totalConversions: 10,
      firstTouch: [{ source: 'email', conversions: 6, share: 60 }],
      lastTouch: [{ source: 'linkedin', conversions: 4, share: 40 }],
    });

    const app = createDispatchApp(db);
    const response = await app.request(
      'http://localhost/__dispatch/analytics/attribution',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversionEvents: ['conversion'],
        }),
      },
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(getAttributionModel).toHaveBeenCalledWith(db, 'org-1', {
      conversionEvents: ['conversion'],
      startDate: undefined,
      endDate: undefined,
    });
    await expect(response.json()).resolves.toEqual({
      totalConversions: 10,
      firstTouch: [{ source: 'email', conversions: 6, share: 60 }],
      lastTouch: [{ source: 'linkedin', conversions: 4, share: 40 }],
    });
  });

  it('returns report-run payload parity for /reports/run', async () => {
    vi.mocked(findReportById).mockResolvedValue({
      id: 'report-1',
      organizationId: 'org-1',
      name: 'Lifecycle report',
      steps: { type: 'custom' },
      createdBy: 'user-1',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
    } as Awaited<ReturnType<typeof findReportById>>);
    vi.mocked(updateReport).mockResolvedValue({
      id: 'report-1',
    } as Awaited<ReturnType<typeof updateReport>>);
    vi.mocked(runTypedReport).mockResolvedValue({
      reportId: 'report-1',
      generatedAt: '2026-02-20T23:59:59.000Z',
      data: {
        name: 'Lifecycle report',
        type: 'contact_growth',
        config: { type: 'contact_growth' },
        dateRange: {
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-02-20T23:59:59.000Z',
        },
        labels: ['2026-02-01'],
        datasets: [{ label: 'New Contacts', data: [4] }],
        summary: { totalNewContacts: 4 },
      },
    });

    const app = createDispatchApp(db);
    const response = await app.request(
      'http://localhost/__dispatch/analytics/reports/run',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'report-1',
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-02-20T23:59:59.000Z',
        }),
      },
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(updateReport).toHaveBeenCalledWith(db, 'org-1', 'report-1', {});
    expect(runTypedReport).toHaveBeenCalledWith(
      db,
      'org-1',
      expect.objectContaining({ id: 'report-1' }),
      {
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-20T23:59:59.000Z',
      },
    );

    const payload = await response.json<{
      reportId: string;
      data: {
        name: string;
        dateRange: { startDate?: string; endDate?: string };
        labels: string[];
        datasets: Array<{ label: string; data: number[] }>;
        summary: Record<string, unknown>;
      };
    }>();

    expect(payload.reportId).toBe('report-1');
    expect(payload.data).toEqual(
      expect.objectContaining({
        name: 'Lifecycle report',
        dateRange: {
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-02-20T23:59:59.000Z',
        },
        labels: ['2026-02-01'],
        datasets: [{ label: 'New Contacts', data: [4] }],
        summary: { totalNewContacts: 4 },
      }),
    );
  });
});
