import { pgSchema, uuid, varchar, text, timestamp, jsonb, integer, numeric, boolean } from 'drizzle-orm/pg-core';

export const leadIntelligenceSchema = pgSchema('lead_intelligence');

export const enrichmentProviders = leadIntelligenceSchema.table('enrichment_providers', {
  id: varchar('id', { length: 50 }).primaryKey(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  provider_type: varchar('provider_type', { length: 50 }).notNull(), // clearbit, apollo, zoominfo, hunter, rocketreach, lusha
  supported_fields: jsonb('supported_fields').notNull().$type<string[]>(),
  priority: integer('priority').notNull().default(0),
  cost_per_lookup: numeric('cost_per_lookup', { precision: 10, scale: 4 }).notNull().default('0'),
  avg_latency_ms: integer('avg_latency_ms').default(0),
  success_rate: numeric('success_rate', { precision: 5, scale: 4 }).default('0'),
  batch_supported: boolean('batch_supported').default(false),
  config: jsonb('config').$type<Record<string, unknown>>(),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
}));

export const waterfallConfigs = leadIntelligenceSchema.table('waterfall_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  field_name: varchar('field_name', { length: 50 }).notNull(),
  provider_order: jsonb('provider_order').notNull().$type<string[]>(),
  max_attempts: integer('max_attempts').notNull().default(3),
  timeout_ms: integer('timeout_ms').notNull().default(5000),
  min_confidence: numeric('min_confidence', { precision: 3, scale: 2 }).notNull().default('0.5'),
  cache_ttl_days: integer('cache_ttl_days').notNull().default(7),
  max_cost_per_lead: numeric('max_cost_per_lead', { precision: 10, scale: 4 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgFieldIdx: { columns: [table.organization_id, table.field_name] },
}));

export const enrichmentJobs = leadIntelligenceSchema.table('enrichment_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed, exhausted
  field_requests: jsonb('field_requests').notNull().$type<string[]>(),
  results: jsonb('results').$type<Array<{
    field: string;
    provider: string;
    value: unknown;
    confidence: number;
    cost: number;
    latencyMs: number;
  }>>(),
  total_cost: numeric('total_cost', { precision: 10, scale: 4 }).default('0'),
  total_latency_ms: integer('total_latency_ms').default(0),
  providers_tried: jsonb('providers_tried').$type<string[]>(),
  error: text('error'),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  statusIdx: { columns: [table.status] },
}));

export const enrichmentCache = leadIntelligenceSchema.table('enrichment_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  field_name: varchar('field_name', { length: 50 }).notNull(),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  value: jsonb('value'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  lookupIdx: { columns: [table.organization_id, table.contact_id, table.field_name] },
  expiryIdx: { columns: [table.expires_at] },
}));

export const providerHealth = leadIntelligenceSchema.table('provider_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  success_count: integer('success_count').notNull().default(0),
  failure_count: integer('failure_count').notNull().default(0),
  last_failure_at: timestamp('last_failure_at'),
  last_success_at: timestamp('last_success_at'),
  circuit_state: varchar('circuit_state', { length: 20 }).notNull().default('closed'), // closed, open, half_open
  circuit_opened_at: timestamp('circuit_opened_at'),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgProviderIdx: { columns: [table.organization_id, table.provider_id] },
}));

export const enrichmentAuditLog = leadIntelligenceSchema.table('enrichment_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  job_id: uuid('job_id'),
  field_name: varchar('field_name', { length: 50 }).notNull(),
  old_value: jsonb('old_value'),
  new_value: jsonb('new_value'),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  jobIdx: { columns: [table.job_id] },
}));
