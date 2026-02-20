import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const campaignSchema = pgSchema('campaign');

// Campaigns table
export const campaigns = campaignSchema.table('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull(), // email/sms/push/multichannel
  status: varchar('status', { length: 20 }).notNull(), // draft/scheduled/sending/sent/paused/canceled
  subject: varchar('subject', { length: 500 }),
  templateId: uuid('template_id'),
  segmentId: uuid('segment_id'),
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  recipientCount: integer('recipient_count').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  deliveredCount: integer('delivered_count').default(0).notNull(),
  openCount: integer('open_count').default(0).notNull(),
  clickCount: integer('click_count').default(0).notNull(),
  bounceCount: integer('bounce_count').default(0).notNull(),
  complaintCount: integer('complaint_count').default(0).notNull(),
  unsubscribeCount: integer('unsubscribe_count').default(0).notNull(),
  openRate: real('open_rate').default(0).notNull(),
  clickRate: real('click_rate').default(0).notNull(),
  lastEventAt: timestamp('last_event_at'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Campaign versions
export const campaignVersions = campaignSchema.table('campaign_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  subject: varchar('subject', { length: 500 }),
  contentTemplateId: uuid('content_template_id'),
  segmentIds: jsonb('segment_ids'), // array of segment UUIDs
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Campaign stats
export const campaignStats = campaignSchema.table(
  'campaign_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    totalRecipients: integer('total_recipients').default(0).notNull(),
    sent: integer('sent').default(0).notNull(),
    delivered: integer('delivered').default(0).notNull(),
    opened: integer('opened').default(0).notNull(),
    clicked: integer('clicked').default(0).notNull(),
    bounced: integer('bounced').default(0).notNull(),
    complained: integer('complained').default(0).notNull(),
    unsubscribed: integer('unsubscribed').default(0).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    campaignOrgIdx: uniqueIndex('campaign_stats_campaign_org_idx').on(
      table.campaignId,
      table.organizationId,
    ),
  }),
);

// A/B tests
export const abTests = campaignSchema.table('ab_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  variants: jsonb('variants').notNull(), // array of variant configs
  winningCriteria: varchar('winning_criteria', { length: 50 }),
  testPercentage: integer('test_percentage').default(20).notNull(),
  winnerVariantId: varchar('winner_variant_id', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull(), // running/completed/canceled
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Point rules
export const pointRules = campaignSchema.table('point_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // email.opened/email.clicked/form.submitted/page.visited/contact.tagged/custom
  points: integer('points').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Point log - tracks individual point awards
export const pointLog = campaignSchema.table('point_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  contactId: uuid('contact_id').notNull(),
  ruleId: uuid('rule_id'),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  points: integer('points').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Campaign summaries (denormalized projections for fast listing/filtering)
export const campaignSummaries = campaignSchema.table(
  'campaign_summaries',
  {
    campaignId: uuid('campaign_id')
      .primaryKey()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    templateId: uuid('template_id'),
    segmentId: uuid('segment_id'),
    createdBy: uuid('created_by').notNull(),
    scheduledAt: timestamp('scheduled_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    recipientCount: integer('recipient_count').default(0).notNull(),
    sentCount: integer('sent_count').default(0).notNull(),
    failedCount: integer('failed_count').default(0).notNull(),
    deliveredCount: integer('delivered_count').default(0).notNull(),
    openCount: integer('open_count').default(0).notNull(),
    clickCount: integer('click_count').default(0).notNull(),
    bounceCount: integer('bounce_count').default(0).notNull(),
    complaintCount: integer('complaint_count').default(0).notNull(),
    unsubscribeCount: integer('unsubscribe_count').default(0).notNull(),
    openRate: real('open_rate').default(0).notNull(),
    clickRate: real('click_rate').default(0).notNull(),
    lastEventAt: timestamp('last_event_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    byOrgStatus: index('campaign_summaries_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    byOrgUpdated: index('campaign_summaries_org_updated_idx').on(
      table.organizationId,
      table.updatedAt,
    ),
    byOrgName: index('campaign_summaries_org_name_idx').on(
      table.organizationId,
      table.name,
    ),
  }),
);
