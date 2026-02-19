import { pgSchema, uuid, varchar, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const integrationsSchema = pgSchema('integrations');

// Connections to external services
export const connections = integrationsSchema.table('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // salesforce/hubspot/zapier/webhook/custom/clearbit/apollo/hunter/zoominfo/rocketreach/lusha
  name: varchar('name', { length: 255 }).notNull(),
  config: jsonb('config').notNull(), // encrypted config (API keys, tokens, etc.)
  status: varchar('status', { length: 20 }).notNull(), // active/inactive/error
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sync jobs (for bi-directional sync)
export const syncJobs = integrationsSchema.table('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  direction: varchar('direction', { length: 20 }).notNull(), // inbound/outbound
  entityType: varchar('entity_type', { length: 100 }).notNull(), // contacts/companies/deals/etc.
  status: varchar('status', { length: 20 }).notNull(), // pending/running/completed/failed
  recordsProcessed: integer('records_processed').default(0).notNull(),
  recordsFailed: integer('records_failed').default(0).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
});

// Webhooks (outbound notifications)
export const webhooks = integrationsSchema.table('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  url: text('url').notNull(),
  events: jsonb('events').notNull(), // array of event types to subscribe to
  secret: varchar('secret', { length: 255 }).notNull(), // for signing webhook payloads
  isActive: boolean('is_active').default(true).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Webhook deliveries (audit log)
export const webhookDeliveries = integrationsSchema.table('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id')
    .notNull()
    .references(() => webhooks.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  attemptCount: integer('attempt_count').default(1).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
