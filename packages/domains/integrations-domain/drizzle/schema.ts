import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

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

// OAuth apps (marketplace integration registrations)
export const oauthApps = integrationsSchema.table('oauth_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'), // null for platform-level apps
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logoUrl: text('logo_url'),
  clientId: varchar('client_id', { length: 64 }).notNull().unique(),
  clientSecret: varchar('client_secret', { length: 128 }).notNull(),
  redirectUris: jsonb('redirect_uris').notNull(), // string[]
  scopes: jsonb('scopes').notNull(), // string[]
  isPublished: boolean('is_published').default(false).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// OAuth authorization grants
export const oauthGrants = integrationsSchema.table('oauth_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id')
    .notNull()
    .references(() => oauthApps.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  code: varchar('code', { length: 128 }).unique(), // authorization code (short-lived)
  accessToken: varchar('access_token', { length: 128 }).unique(),
  refreshToken: varchar('refresh_token', { length: 128 }).unique(),
  scopes: jsonb('scopes').notNull(), // approved scopes
  codeExpiresAt: timestamp('code_expires_at'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
export const webhookDeliveries = integrationsSchema.table(
  'webhook_deliveries',
  {
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
  },
);
