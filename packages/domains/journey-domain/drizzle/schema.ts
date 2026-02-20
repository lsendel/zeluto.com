import {
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const journeySchema = pgSchema('journey');

// journeys: id, organization_id, name, description, status (draft/active/paused/archived), created_by, created_at, updated_at
export const journeys = journeySchema.table(
  'journeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft/active/paused/archived
    created_by: uuid('created_by').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgStatusIdx: { columns: [table.organization_id, table.status] },
  }),
);

// journey_versions: id, journey_id, organization_id, version_number, definition (jsonb - the DAG), published_at, created_at
export const journey_versions = journeySchema.table(
  'journey_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journey_id: uuid('journey_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    version_number: integer('version_number').notNull(),
    definition: jsonb('definition').notNull(), // the DAG
    published_at: timestamp('published_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    journeyIdx: { columns: [table.journey_id] },
  }),
);

// journey_steps: id, journey_version_id, organization_id, type (trigger/action/condition/delay/split), config (jsonb), position_x, position_y
export const journey_steps = journeySchema.table('journey_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  journey_version_id: uuid('journey_version_id').notNull(),
  organization_id: uuid('organization_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // trigger/action/condition/delay/split
  config: jsonb('config').notNull(),
  position_x: integer('position_x').notNull(),
  position_y: integer('position_y').notNull(),
});

// journey_step_connections: id, from_step_id, to_step_id, label (for condition branches: "yes"/"no")
export const journey_step_connections = journeySchema.table(
  'journey_step_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    from_step_id: uuid('from_step_id').notNull(),
    to_step_id: uuid('to_step_id').notNull(),
    label: varchar('label', { length: 255 }),
  },
);

// journey_triggers: id, journey_id, organization_id, type (event/segment/manual/scheduled/score_threshold/intent_signal), config (jsonb)
export const journey_triggers = journeySchema.table(
  'journey_triggers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journey_id: uuid('journey_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(), // event/segment/manual/scheduled/score_threshold/intent_signal
    config: jsonb('config').notNull(),
  },
  (table) => ({
    journeyIdx: { columns: [table.journey_id] },
  }),
);

// journey_executions: id, journey_id, journey_version_id, organization_id, contact_id, status (active/completed/failed/canceled), started_at, completed_at, current_step_id
export const journey_executions = journeySchema.table(
  'journey_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journey_id: uuid('journey_id').notNull(),
    journey_version_id: uuid('journey_version_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    contact_id: uuid('contact_id').notNull(),
    status: varchar('status', { length: 50 }).notNull(), // active/completed/failed/canceled
    started_at: timestamp('started_at').notNull().defaultNow(),
    completed_at: timestamp('completed_at'),
    current_step_id: uuid('current_step_id'),
  },
  (table) => ({
    orgStatusIdx: { columns: [table.organization_id, table.status] },
    journeyContactIdx: { columns: [table.journey_id, table.contact_id] },
  }),
);

// step_executions: id, execution_id, step_id, organization_id, status (pending/running/completed/failed/skipped), started_at, completed_at, result (jsonb), error
export const step_executions = journeySchema.table(
  'step_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    execution_id: uuid('execution_id').notNull(),
    step_id: uuid('step_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    status: varchar('status', { length: 50 }).notNull(), // pending/running/completed/failed/skipped
    started_at: timestamp('started_at'),
    completed_at: timestamp('completed_at'),
    result: jsonb('result'),
    error: text('error'),
  },
  (table) => ({
    executionIdx: { columns: [table.execution_id] },
  }),
);

// execution_logs: id, execution_id, organization_id, level (info/warn/error), message, metadata (jsonb), created_at
export const execution_logs = journeySchema.table(
  'execution_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    execution_id: uuid('execution_id').notNull(),
    organization_id: uuid('organization_id').notNull(),
    level: varchar('level', { length: 50 }).notNull(), // info/warn/error
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    executionIdx: { columns: [table.execution_id] },
  }),
);
