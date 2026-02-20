import { createDatabase, tenantMiddleware } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { buildContactTimelineReadModel } from '../application/contact-timeline-read-model.js';
import {
  getCampaignStats,
  getJourneyStats,
  getOverviewStats,
} from '../infrastructure/repositories/dashboard-repository.js';
import {
  logEvent,
  queryAggregates,
  queryEvents,
} from '../infrastructure/repositories/event-repository.js';
import {
  createReport,
  deleteReport,
  findAllReports,
  findReportById,
  updateReport,
} from '../infrastructure/repositories/report-repository.js';

export const analyticsDispatchRoutes = new Hono<Env>();

analyticsDispatchRoutes.use('*', tenantMiddleware());
analyticsDispatchRoutes.use('*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as NeonHttpDatabase);
  await next();
});

analyticsDispatchRoutes.post('/events/log', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    contactId?: string;
    eventType?: string;
    eventSource?: string;
    eventData?: Record<string, unknown>;
  } | null;

  if (!body?.contactId || !body.eventType) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'contactId and eventType are required',
      },
      400,
    );
  }

  const event = await logEvent(db, tenant.organizationId, {
    contactId: body.contactId,
    eventType: body.eventType,
    eventSource: body.eventSource,
    eventData: body.eventData,
  });

  return c.json(event, 201);
});

analyticsDispatchRoutes.post('/events/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
    eventType?: string;
    contactId?: string;
    startDate?: string;
    endDate?: string;
  } | null;

  const page = Math.max(1, Number(body?.page ?? 1));
  const limit = Math.max(1, Math.min(100, Number(body?.limit ?? 25)));

  const result = await queryEvents(db, tenant.organizationId, {
    page,
    limit,
    eventType: body?.eventType ?? undefined,
    contactId: body?.contactId ?? undefined,
    startDate: body?.startDate ?? undefined,
    endDate: body?.endDate ?? undefined,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

analyticsDispatchRoutes.post('/events/aggregates', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    startDate?: string;
    endDate?: string;
    eventType?: string;
  } | null;

  const aggregates = await queryAggregates(db, tenant.organizationId, {
    startDate: body?.startDate ?? undefined,
    endDate: body?.endDate ?? undefined,
    eventType: body?.eventType ?? undefined,
  });

  return c.json({ data: aggregates });
});

analyticsDispatchRoutes.post('/events/activity', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    contactId?: string;
    page?: number;
    limit?: number;
  } | null;

  if (!body?.contactId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'contactId is required' },
      400,
    );
  }

  const page = Math.max(1, Number(body?.page ?? 1));
  const limit = Math.max(1, Math.min(100, Number(body?.limit ?? 25)));

  const result = await queryEvents(db, tenant.organizationId, {
    page,
    limit,
    contactId: body.contactId,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

analyticsDispatchRoutes.post('/events/timeline', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    contactId?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  } | null;

  if (!body?.contactId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'contactId is required' },
      400,
    );
  }

  const page = Math.max(1, Number(body?.page ?? 1));
  const limit = Math.max(1, Math.min(200, Number(body?.limit ?? 50)));

  const result = await queryEvents(db, tenant.organizationId, {
    page,
    limit,
    contactId: body.contactId,
    startDate: body.startDate ?? undefined,
    endDate: body.endDate ?? undefined,
  });

  return c.json(
    buildContactTimelineReadModel(result.data, {
      page,
      limit,
      total: result.total,
    }),
  );
});

analyticsDispatchRoutes.post('/overview', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stats = await getOverviewStats(db, tenant.organizationId);

  let emailsSentToday = 0;
  let totalOpened = 0;
  let totalClicked = 0;
  for (const agg of stats.aggregates) {
    if (agg.eventType === 'email_sent') emailsSentToday += agg.count;
    if (agg.eventType === 'email_opened') totalOpened += agg.count;
    if (agg.eventType === 'email_clicked') totalClicked += agg.count;
  }

  const openRate =
    emailsSentToday > 0 ? (totalOpened / emailsSentToday) * 100 : 0;
  const clickRate =
    emailsSentToday > 0 ? (totalClicked / emailsSentToday) * 100 : 0;

  return c.json({
    totalContacts: 0,
    activeJourneys: 0,
    campaignsSent: 0,
    emailsSentToday,
    openRate: Math.round(openRate * 100) / 100,
    clickRate: Math.round(clickRate * 100) / 100,
    conversionRate: 0,
    recentActivity: stats.recentActivity,
  });
});

analyticsDispatchRoutes.post('/campaigns/performance', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    campaignId?: string;
    startDate?: string;
    endDate?: string;
  } | null;

  if (!body?.campaignId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'campaignId is required' },
      400,
    );
  }

  const dailyStats = await getCampaignStats(
    db,
    tenant.organizationId,
    body.campaignId,
    {
      startDate: body.startDate ?? undefined,
      endDate: body.endDate ?? undefined,
    },
  );

  let sent = 0,
    delivered = 0,
    opened = 0,
    clicked = 0,
    bounced = 0,
    complained = 0,
    unsubscribed = 0;

  for (const day of dailyStats) {
    sent += day.sent;
    delivered += day.delivered;
    opened += day.opened;
    clicked += day.clicked;
    bounced += day.bounced;
    complained += day.complained;
    unsubscribed += day.unsubscribed;
  }

  const uniqueOpened = dailyStats.reduce((sum, d) => sum + d.uniqueOpened, 0);
  const uniqueClicked = dailyStats.reduce((sum, d) => sum + d.uniqueClicked, 0);

  return c.json({
    campaignId: body.campaignId,
    campaignName: '',
    totalRecipients: sent,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed,
    openRate: sent > 0 ? Math.round((uniqueOpened / sent) * 10000) / 100 : 0,
    clickRate: sent > 0 ? Math.round((uniqueClicked / sent) * 10000) / 100 : 0,
    clickToOpenRate:
      uniqueOpened > 0
        ? Math.round((uniqueClicked / uniqueOpened) * 10000) / 100
        : 0,
    bounceRate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
    dailyStats,
  });
});

analyticsDispatchRoutes.post('/journeys/performance', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    journeyId?: string;
  } | null;

  if (!body?.journeyId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'journeyId is required' },
      400,
    );
  }

  const dailyStats = await getJourneyStats(
    db,
    tenant.organizationId,
    body.journeyId,
  );

  let totalStarted = 0,
    totalCompleted = 0,
    totalFailed = 0,
    currentlyActive = 0;

  for (const day of dailyStats) {
    totalStarted += day.started;
    totalCompleted += day.completed;
    totalFailed += day.failed;
    currentlyActive += day.active;
  }

  return c.json({
    journeyId: body.journeyId,
    journeyName: '',
    totalStarted,
    totalCompleted,
    totalFailed,
    currentlyActive,
    completionRate:
      totalStarted > 0
        ? Math.round((totalCompleted / totalStarted) * 10000) / 100
        : 0,
    avgTimeToComplete: null,
    dailyStats,
    stepStats: [],
  });
});

analyticsDispatchRoutes.post('/reports/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
  } | null;
  const page = Math.max(1, Number(body?.page ?? 1));
  const limit = Math.max(1, Math.min(100, Number(body?.limit ?? 25)));

  const result = await findAllReports(db, tenant.organizationId, {
    page,
    limit,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

analyticsDispatchRoutes.post('/reports/get', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }
  const report = await findReportById(db, tenant.organizationId, body.id);
  if (!report) {
    return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
  }
  return c.json(report);
});

analyticsDispatchRoutes.post('/reports/create', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    type?: string;
    config?: Record<string, unknown>;
  } | null;

  if (!body?.name) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'name is required' },
      400,
    );
  }

  const report = await createReport(db, tenant.organizationId, {
    name: body.name,
    steps: body.config ?? { type: body.type ?? 'custom' },
    createdBy: tenant.userId,
  });

  return c.json(report, 201);
});

analyticsDispatchRoutes.post('/reports/update', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    id?: string;
    name?: string;
    config?: Record<string, unknown>;
  } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.config !== undefined) updateData.steps = body.config;

  const report = await updateReport(
    db,
    tenant.organizationId,
    body.id,
    updateData,
  );
  if (!report) {
    return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
  }

  return c.json(report);
});

analyticsDispatchRoutes.post('/reports/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const deleted = await deleteReport(db, tenant.organizationId, body.id);
  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
  }
  return c.json({ success: true });
});

analyticsDispatchRoutes.post('/reports/run', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    id?: string;
    startDate?: string;
    endDate?: string;
  } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const report = await findReportById(db, tenant.organizationId, body.id);
  if (!report) {
    return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
  }

  await updateReport(db, tenant.organizationId, body.id, {});

  return c.json({
    reportId: report.id,
    generatedAt: new Date().toISOString(),
    data: {
      name: report.name,
      config: report.steps,
      dateRange: { startDate: body.startDate, endDate: body.endDate },
      labels: [],
      datasets: [],
      summary: {},
    },
  });
});
