import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const crmSchema = pgSchema('crm');

// contacts: id, organization_id, email, first_name, last_name, phone, status, stage, custom_fields (jsonb), last_activity_at, created_at, updated_at
export const contacts = crmSchema.table(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    email: varchar('email', { length: 255 }),
    first_name: varchar('first_name', { length: 255 }),
    last_name: varchar('last_name', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    status: varchar('status', { length: 50 }).notNull().default('active'), // active/unsubscribed/bounced/do_not_contact
    stage: varchar('stage', { length: 50 }).default('subscriber'), // subscriber/lead/mql/sql/opportunity/customer/evangelist/other
    custom_fields: jsonb('custom_fields'),
    last_activity_at: timestamp('last_activity_at'),
    // Enrichment & scoring fields
    lead_score: numeric('lead_score', { precision: 5, scale: 2 }),
    lead_grade: varchar('lead_grade', { length: 1 }),
    intent_score: numeric('intent_score', { precision: 5, scale: 2 }),
    enrichment_status: varchar('enrichment_status', { length: 20 }),
    last_enriched_at: timestamp('last_enriched_at'),
    data_quality_score: numeric('data_quality_score', {
      precision: 3,
      scale: 2,
    }),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgEmailIdx: { columns: [table.organization_id, table.email] },
    orgUpdatedIdx: { columns: [table.organization_id, table.updated_at] },
  }),
);

// companies: id, organization_id, name, domain, industry, size, custom_fields (jsonb), created_at, updated_at
export const companies = crmSchema.table(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    industry: varchar('industry', { length: 255 }),
    size: varchar('size', { length: 50 }),
    custom_fields: jsonb('custom_fields'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: { columns: [table.organization_id] },
  }),
);

// contact_companies: id, contact_id, company_id, role (junction)
export const contact_companies = crmSchema.table('contact_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  contact_id: uuid('contact_id').notNull(),
  company_id: uuid('company_id').notNull(),
  role: varchar('role', { length: 255 }),
});

// segments: id, organization_id, name, description, type (static/dynamic), filter_criteria (jsonb), contact_count, created_at, updated_at
export const segments = crmSchema.table(
  'segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 50 }).notNull(), // static/dynamic
    filter_criteria: jsonb('filter_criteria'),
    contact_count: integer('contact_count').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: { columns: [table.organization_id] },
  }),
);

// segment_contacts: id, segment_id, contact_id, added_at (for static segments)
export const segment_contacts = crmSchema.table('segment_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  segment_id: uuid('segment_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  added_at: timestamp('added_at').notNull().defaultNow(),
});

// tags: id, organization_id, name, color, created_at
export const tags = crmSchema.table(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    color: varchar('color', { length: 50 }),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: { columns: [table.organization_id] },
  }),
);

// contact_tags: id, contact_id, tag_id
export const contact_tags = crmSchema.table('contact_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  contact_id: uuid('contact_id').notNull(),
  tag_id: uuid('tag_id').notNull(),
});

// outbox_events: transactional outbox for reliable event publishing
export const outbox_events = crmSchema.table(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_type: varchar('event_type', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    published_at: timestamp('published_at'),
  },
  (table) => ({
    unpublishedIdx: { columns: [table.published_at, table.created_at] },
  }),
);

// fields: id, organization_id, entity_type (contact/company), name, label, field_type (text/number/date/select/multiselect), options (jsonb), is_required, sort_order, created_at
export const fields = crmSchema.table(
  'fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(), // contact/company
    name: varchar('name', { length: 255 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    field_type: varchar('field_type', { length: 50 }).notNull(), // text/number/date/select/multiselect
    options: jsonb('options'),
    is_required: boolean('is_required').notNull().default(false),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgEntityIdx: { columns: [table.organization_id, table.entity_type] },
  }),
);
