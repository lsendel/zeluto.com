import { pgSchema, uuid, varchar, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const campaignSchema = pgSchema('campaign');

// Campaigns table
export const campaigns = campaignSchema.table('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull(), // email/sms/push/multichannel
  status: varchar('status', { length: 20 }).notNull(), // draft/scheduled/sending/sent/paused/canceled
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
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
export const campaignStats = campaignSchema.table('campaign_stats', {
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
});

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
  winnerVariant: varchar('winner_variant', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull(), // running/completed
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});
