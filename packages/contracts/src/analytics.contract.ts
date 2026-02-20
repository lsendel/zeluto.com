import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  IdParamSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const EventAggregateSchema = z.object({
  date: z.string(),
  eventType: z.string(),
  channel: z.string().nullable(),
  count: z.number(),
  uniqueCount: z.number(),
});

export const ContactActivitySchema = z.object({
  id: z.number(),
  contactId: z.number(),
  eventType: z.string(),
  eventSource: z.string(),
  eventData: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const CampaignDailyStatsSchema = z.object({
  campaignId: z.number(),
  date: z.string(),
  sent: z.number(),
  delivered: z.number(),
  opened: z.number(),
  clicked: z.number(),
  bounced: z.number(),
});

export const JourneyDailyStatsSchema = z.object({
  journeyId: z.number(),
  date: z.string(),
  started: z.number(),
  completed: z.number(),
  failed: z.number(),
  active: z.number(),
});

export const ReportSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['campaign', 'journey', 'contact', 'custom']),
  config: z.record(z.string(), z.unknown()),
  createdBy: z.number(),
  createdAt: z.string(),
});

export const DashboardWidgetSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['metric', 'chart', 'table', 'list']),
  config: z.record(z.string(), z.unknown()),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OverviewStatsSchema = z.object({
  totalContacts: z.number(),
  activeJourneys: z.number(),
  campaignsSent: z.number(),
  emailsSentToday: z.number(),
  openRate: z.number(),
  clickRate: z.number(),
  conversionRate: z.number(),
  recentActivity: z.array(ContactActivitySchema),
});

export const CampaignPerformanceSchema = z.object({
  campaignId: z.number(),
  campaignName: z.string(),
  totalRecipients: z.number(),
  sent: z.number(),
  delivered: z.number(),
  opened: z.number(),
  clicked: z.number(),
  bounced: z.number(),
  complained: z.number(),
  unsubscribed: z.number(),
  openRate: z.number(),
  clickRate: z.number(),
  clickToOpenRate: z.number(),
  bounceRate: z.number(),
  dailyStats: z.array(CampaignDailyStatsSchema),
});

export const JourneyPerformanceSchema = z.object({
  journeyId: z.number(),
  journeyName: z.string(),
  totalStarted: z.number(),
  totalCompleted: z.number(),
  totalFailed: z.number(),
  currentlyActive: z.number(),
  completionRate: z.number(),
  avgTimeToComplete: z.number().nullable(),
  dailyStats: z.array(JourneyDailyStatsSchema),
  stepStats: z.array(
    z.object({
      stepId: z.string(),
      stepName: z.string(),
      entered: z.number(),
      completed: z.number(),
      failed: z.number(),
    }),
  ),
});

export const ReportResultSchema = z.object({
  reportId: z.number(),
  generatedAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const EventsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

const PerformanceQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const CreateReportBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['campaign', 'journey', 'contact', 'custom']),
  config: z.record(z.string(), z.unknown()),
});

const RunReportBodySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const CreateWidgetBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['metric', 'chart', 'table', 'list']),
  config: z.record(z.string(), z.unknown()),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
});

const UpdateWidgetBodySchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
});

const ReorderWidgetsBodySchema = z.object({
  widgets: z.array(
    z.object({
      id: z.number(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
      }),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const analyticsContract = c.router({
  overview: {
    get: {
      method: 'GET',
      path: '/api/v1/analytics/overview',
      responses: {
        200: OverviewStatsSchema,
      },
    },
  },
  events: {
    list: {
      method: 'GET',
      path: '/api/v1/analytics/events',
      query: EventsQuerySchema,
      responses: {
        200: z.array(EventAggregateSchema),
      },
    },
  },
  contactActivity: {
    list: {
      method: 'GET',
      path: '/api/v1/analytics/contacts/:id/activity',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(ContactActivitySchema),
        404: ErrorSchema,
      },
    },
  },
  campaignPerformance: {
    get: {
      method: 'GET',
      path: '/api/v1/analytics/campaigns/:id/performance',
      pathParams: IdParamSchema,
      query: PerformanceQuerySchema,
      responses: {
        200: CampaignPerformanceSchema,
        404: ErrorSchema,
      },
    },
  },
  journeyPerformance: {
    get: {
      method: 'GET',
      path: '/api/v1/analytics/journeys/:id/performance',
      pathParams: IdParamSchema,
      query: PerformanceQuerySchema,
      responses: {
        200: JourneyPerformanceSchema,
        404: ErrorSchema,
      },
    },
  },
  reports: {
    list: {
      method: 'GET',
      path: '/api/v1/analytics/reports',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(ReportSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/analytics/reports',
      body: CreateReportBodySchema,
      responses: {
        201: ReportSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/analytics/reports/:id',
      pathParams: IdParamSchema,
      responses: {
        200: ReportSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/analytics/reports/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    run: {
      method: 'POST',
      path: '/api/v1/analytics/reports/:id/run',
      pathParams: IdParamSchema,
      body: RunReportBodySchema.optional(),
      responses: {
        200: ReportResultSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  dashboardWidgets: {
    list: {
      method: 'GET',
      path: '/api/v1/analytics/dashboard/widgets',
      responses: {
        200: z.array(DashboardWidgetSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/analytics/dashboard/widgets',
      body: CreateWidgetBodySchema,
      responses: {
        201: DashboardWidgetSchema,
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/analytics/dashboard/widgets/:id',
      pathParams: IdParamSchema,
      body: UpdateWidgetBodySchema,
      responses: {
        200: DashboardWidgetSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/analytics/dashboard/widgets/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    reorder: {
      method: 'POST',
      path: '/api/v1/analytics/dashboard/widgets/reorder',
      body: ReorderWidgetsBodySchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: ErrorSchema,
      },
    },
  },
});
