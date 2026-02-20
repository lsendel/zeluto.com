import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const deliverySchema = pgSchema('delivery');

// delivery_jobs: id, organization_id, channel (email/sms/push/webhook), status (queued/sending/sent/failed/partial), recipient_count, sent_count, failed_count, idempotency_key (unique), metadata (jsonb), created_at, completed_at
export const delivery_jobs = deliverySchema.table(
  'delivery_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    channel: varchar('channel', { length: 50 }).notNull(), // email/sms/push/webhook
    status: varchar('status', { length: 50 }).notNull().default('queued'), // queued/sending/sent/failed/partial
    recipient_count: integer('recipient_count').notNull().default(0),
    sent_count: integer('sent_count').notNull().default(0),
    failed_count: integer('failed_count').notNull().default(0),
    idempotency_key: varchar('idempotency_key', { length: 255 })
      .notNull()
      .unique(),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    completed_at: timestamp('completed_at'),
  },
  (table) => ({
    orgStatusIdx: { columns: [table.organization_id, table.status] },
  }),
);

// delivery_events: id, job_id, organization_id, contact_id, channel, event_type (sent/delivered/bounced/opened/clicked/complained/unsubscribed), provider_message_id, metadata (jsonb), created_at
export const delivery_events = deliverySchema.table(
  'delivery_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    job_id: uuid('job_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    channel: varchar('channel', { length: 50 }).notNull(),
    event_type: varchar('event_type', { length: 50 }).notNull(), // sent/delivered/bounced/opened/clicked/complained/unsubscribed
    provider_message_id: varchar('provider_message_id', { length: 255 }),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: { columns: [table.job_id] },
    orgIdx: { columns: [table.organization_id] },
  }),
);

// provider_configs: id, organization_id, channel, provider_type (ses/sendgrid/twilio/postmark/custom_smtp), config (jsonb - encrypted), is_active, priority, created_at, updated_at
export const provider_configs = deliverySchema.table(
  'provider_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    channel: varchar('channel', { length: 50 }).notNull(),
    provider_type: varchar('provider_type', { length: 50 }).notNull(), // ses/sendgrid/twilio/postmark/custom_smtp
    config: jsonb('config').notNull(), // encrypted
    is_active: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgChannelIdx: { columns: [table.organization_id, table.channel] },
  }),
);

// suppressions: id, organization_id, email, reason (bounce/complaint/unsubscribe/manual), source, created_at
export const suppressions = deliverySchema.table(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    reason: varchar('reason', { length: 50 }).notNull(), // bounce/complaint/unsubscribe/manual
    source: varchar('source', { length: 255 }),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgEmailIdx: { columns: [table.organization_id, table.email] },
  }),
);

// sending_domains: id, organization_id, domain, status (pending/verified/failed), dns_records (jsonb), verified_at, created_at
export const sending_domains = deliverySchema.table(
  'sending_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    domain: varchar('domain', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // pending/verified/failed
    dns_records: jsonb('dns_records'),
    verified_at: timestamp('verified_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: { columns: [table.organization_id] },
  }),
);
