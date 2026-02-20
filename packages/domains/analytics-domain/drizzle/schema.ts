import {
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const analyticsSchema = pgSchema('analytics');

// Event aggregates (daily rollups)
export const eventAggregates = analyticsSchema.table('event_aggregates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  date: date('date').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  channel: varchar('channel', { length: 50 }),
  count: integer('count').default(0).notNull(),
  uniqueCount: integer('unique_count').default(0).notNull(),
});

// Contact activity log
export const contactActivity = analyticsSchema.table('contact_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  contactId: uuid('contact_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventSource: varchar('event_source', { length: 100 }), // campaign_id, journey_id, etc.
  eventData: jsonb('event_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Campaign daily stats
export const campaignDailyStats = analyticsSchema.table(
  'campaign_daily_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    date: date('date').notNull(),
    sent: integer('sent').default(0).notNull(),
    delivered: integer('delivered').default(0).notNull(),
    opened: integer('opened').default(0).notNull(),
    uniqueOpened: integer('unique_opened').default(0).notNull(),
    clicked: integer('clicked').default(0).notNull(),
    uniqueClicked: integer('unique_clicked').default(0).notNull(),
    bounced: integer('bounced').default(0).notNull(),
    complained: integer('complained').default(0).notNull(),
    unsubscribed: integer('unsubscribed').default(0).notNull(),
  },
);

// Journey daily stats
export const journeyDailyStats = analyticsSchema.table('journey_daily_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  date: date('date').notNull(),
  started: integer('started').default(0).notNull(),
  completed: integer('completed').default(0).notNull(),
  failed: integer('failed').default(0).notNull(),
  active: integer('active').default(0).notNull(),
});

// Funnel reports
export const funnelReports = analyticsSchema.table('funnel_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  steps: jsonb('steps').notNull(), // array of funnel step definitions
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Daily score distribution (aggregated per org per day)
export const dailyScoreDistribution = analyticsSchema.table(
  'daily_score_distribution',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    date: date('date').notNull(),
    avgScore: numeric('avg_score', { precision: 5, scale: 2 }).notNull(),
    minScore: integer('min_score').notNull(),
    maxScore: integer('max_score').notNull(),
    p50: integer('p50').notNull(),
    p90: integer('p90').notNull(),
    p95: integer('p95').notNull(),
    totalContacts: integer('total_contacts').notNull(),
  },
);

// Engagement cohorts by lead grade
export const engagementCohorts = analyticsSchema.table('engagement_cohorts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  date: date('date').notNull(),
  grade: varchar('grade', { length: 5 }).notNull(), // A, B, C, D, F
  count: integer('count').notNull(),
  avgOpenRate: numeric('avg_open_rate', { precision: 5, scale: 2 }).notNull(),
  avgClickRate: numeric('avg_click_rate', { precision: 5, scale: 2 }).notNull(),
});

// Score trends per contact over time
export const scoreTrends = analyticsSchema.table('score_trends', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  contactId: uuid('contact_id').notNull(),
  date: date('date').notNull(),
  scoreValue: integer('score_value').notNull(),
});

// Enrichment metrics (daily per org)
export const enrichmentMetrics = analyticsSchema.table('enrichment_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  date: date('date').notNull(),
  totalEnriched: integer('total_enriched').notNull(),
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).notNull(),
  avgCost: numeric('avg_cost', { precision: 8, scale: 4 }).notNull(),
  avgFreshness: numeric('avg_freshness', { precision: 5, scale: 2 }).notNull(),
});
