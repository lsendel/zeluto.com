import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const scoringSchema = pgSchema('scoring');

export const leadScores = scoringSchema.table(
  'lead_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    total_score: integer('total_score').notNull().default(0),
    grade: varchar('grade', { length: 2 }).notNull().default('F'), // A, B, C, D, F
    engagement_score: integer('engagement_score').notNull().default(0),
    fit_score: integer('fit_score').notNull().default(0),
    intent_score: integer('intent_score').notNull().default(0),
    components: jsonb('components').$type<Record<string, number>>(),
    top_contributors:
      jsonb('top_contributors').$type<
        Array<{ factor: string; points: number }>
      >(),
    scored_at: timestamp('scored_at').notNull().defaultNow(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgContactIdx: { columns: [table.organization_id, table.contact_id] },
    gradeIdx: { columns: [table.organization_id, table.grade] },
    scoreIdx: { columns: [table.organization_id, table.total_score] },
  }),
);

export const scoreHistory = scoringSchema.table(
  'score_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    date: date('date').notNull(),
    total_score: integer('total_score').notNull(),
    engagement_score: integer('engagement_score').notNull().default(0),
    fit_score: integer('fit_score').notNull().default(0),
    intent_score: integer('intent_score').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgContactDateIdx: {
      columns: [table.organization_id, table.contact_id, table.date],
    },
  }),
);

export const intentSignals = scoringSchema.table(
  'intent_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    signal_type: varchar('signal_type', { length: 50 }).notNull(),
    source: varchar('source', { length: 100 }).notNull(),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    detected_at: timestamp('detected_at').notNull().defaultNow(),
    expires_at: timestamp('expires_at'),
    decay_model: varchar('decay_model', { length: 20 })
      .notNull()
      .default('linear'), // linear, exponential, step
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgContactIdx: { columns: [table.organization_id, table.contact_id] },
    signalTypeIdx: { columns: [table.organization_id, table.signal_type] },
    expiryIdx: { columns: [table.expires_at] },
  }),
);

export const signalConfigs = scoringSchema.table(
  'signal_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    signal_type: varchar('signal_type', { length: 50 }).notNull(),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    decay_hours: integer('decay_hours').notNull().default(168), // 7 days
    tier: varchar('tier', { length: 20 }).notNull().default('medium'), // critical, high, medium, low
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgSignalIdx: { columns: [table.organization_id, table.signal_type] },
  }),
);

export const signalAlerts = scoringSchema.table(
  'signal_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    signal_type: varchar('signal_type', { length: 50 }).notNull(),
    priority: varchar('priority', { length: 20 }).notNull(), // critical, high, medium, low
    deadline: timestamp('deadline').notNull(),
    acknowledged_at: timestamp('acknowledged_at'),
    acknowledged_by: uuid('acknowledged_by'),
    status: varchar('status', { length: 20 }).notNull().default('open'), // open, acknowledged, expired
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgStatusIdx: { columns: [table.organization_id, table.status] },
    orgPriorityIdx: { columns: [table.organization_id, table.priority] },
    deadlineIdx: { columns: [table.deadline] },
  }),
);

export const scoringConfigs = scoringSchema.table(
  'scoring_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    category: varchar('category', { length: 50 }).notNull(), // demographic, firmographic, engagement, intent
    factor: varchar('factor', { length: 100 }).notNull(),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgCategoryIdx: { columns: [table.organization_id, table.category] },
  }),
);
