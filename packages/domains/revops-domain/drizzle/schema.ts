import { pgSchema, uuid, varchar, text, timestamp, jsonb, integer, numeric, boolean, date } from 'drizzle-orm/pg-core';

export const revopsSchema = pgSchema('revops');

export const deals = revopsSchema.table('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  account_id: uuid('account_id'),
  contact_id: uuid('contact_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  stage: varchar('stage', { length: 50 }).notNull().default('prospecting'),
  value: numeric('value', { precision: 12, scale: 2 }).notNull().default('0'),
  probability: integer('probability').notNull().default(0),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  assigned_rep: uuid('assigned_rep'),
  expected_close_at: timestamp('expected_close_at'),
  closed_at: timestamp('closed_at'),
  lost_reason: text('lost_reason'),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
  stageIdx: { columns: [table.organization_id, table.stage] },
  repIdx: { columns: [table.assigned_rep] },
  contactIdx: { columns: [table.organization_id, table.contact_id] },
}));

export const activities = revopsSchema.table('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(), // call, email, meeting, demo, task, note, linkedin, sms
  contact_id: uuid('contact_id'),
  deal_id: uuid('deal_id'),
  outcome: varchar('outcome', { length: 50 }),
  duration_minutes: integer('duration_minutes'),
  notes: text('notes'),
  scheduled_at: timestamp('scheduled_at'),
  completed_at: timestamp('completed_at'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
  dealIdx: { columns: [table.deal_id] },
  contactIdx: { columns: [table.contact_id] },
  typeIdx: { columns: [table.organization_id, table.type] },
}));

export const forecasts = revopsSchema.table('forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  period: varchar('period', { length: 20 }).notNull(), // e.g. "2026-Q1"
  rep_id: uuid('rep_id'),
  pipeline_value: numeric('pipeline_value', { precision: 12, scale: 2 }).notNull().default('0'),
  best_case_value: numeric('best_case_value', { precision: 12, scale: 2 }).notNull().default('0'),
  commit_value: numeric('commit_value', { precision: 12, scale: 2 }).notNull().default('0'),
  closed_value: numeric('closed_value', { precision: 12, scale: 2 }).notNull().default('0'),
  weighted_value: numeric('weighted_value', { precision: 12, scale: 2 }).notNull().default('0'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgPeriodIdx: { columns: [table.organization_id, table.period] },
  repIdx: { columns: [table.rep_id] },
}));

export const routingRules = revopsSchema.table('routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  strategy: varchar('strategy', { length: 30 }).notNull(), // round_robin, weighted, territory, skill_based, load_balanced
  conditions: jsonb('conditions').$type<Record<string, unknown>>(),
  target_reps: jsonb('target_reps').notNull().$type<string[]>(),
  priority: integer('priority').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
}));

export const sequences = revopsSchema.table('sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  steps: jsonb('steps').notNull().$type<Array<{
    type: string;
    delay_days: number;
    template_id?: string;
    subject?: string;
    body?: string;
    ab_variants?: Array<{ subject: string; body: string }>;
  }>>(),
  daily_limits: jsonb('daily_limits').$type<{ email: number; linkedin: number; sms: number }>(),
  send_window: jsonb('send_window').$type<{ start_hour: number; end_hour: number; timezone: string }>(),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, active, paused, archived
  created_by: uuid('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
  statusIdx: { columns: [table.organization_id, table.status] },
}));

export const sequenceEnrollments = revopsSchema.table('sequence_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  sequence_id: uuid('sequence_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  current_step: integer('current_step').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, completed, paused, bounced, replied
  enrolled_at: timestamp('enrolled_at').notNull().defaultNow(),
  last_step_at: timestamp('last_step_at'),
  completed_at: timestamp('completed_at'),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
  sequenceIdx: { columns: [table.sequence_id] },
  contactIdx: { columns: [table.organization_id, table.contact_id] },
  statusIdx: { columns: [table.status] },
}));

export const prospects = revopsSchema.table('prospects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  qualification_score: integer('qualification_score').notNull().default(0),
  icp_match: numeric('icp_match', { precision: 5, scale: 2 }).notNull().default('0'),
  reasoning: text('reasoning'),
  recommendation: varchar('recommendation', { length: 30 }).notNull().default('manual_review'), // enrich, sequence, skip, manual_review
  data_completeness: numeric('data_completeness', { precision: 5, scale: 2 }).notNull().default('0'),
  qualified_at: timestamp('qualified_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  recommendationIdx: { columns: [table.organization_id, table.recommendation] },
}));

export const researchJobs = revopsSchema.table('research_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(), // company, person
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed
  results: jsonb('results').$type<Record<string, unknown>>(),
  error: text('error'),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  statusIdx: { columns: [table.status] },
}));

export const researchInsights = revopsSchema.table('research_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  insight_type: varchar('insight_type', { length: 50 }).notNull(),
  content: text('content').notNull(),
  relevance: numeric('relevance', { precision: 3, scale: 2 }).notNull(),
  freshness: numeric('freshness', { precision: 3, scale: 2 }).notNull(),
  source: varchar('source', { length: 100 }),
  expires_at: timestamp('expires_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  insightTypeIdx: { columns: [table.insight_type] },
}));

export const workflows = revopsSchema.table('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  trigger: varchar('trigger', { length: 50 }).notNull(), // deal_created, stage_changed, deal_won, deal_lost, inactivity, score_changed, time_in_stage
  conditions: jsonb('conditions').$type<Record<string, unknown>>(),
  actions: jsonb('actions').notNull().$type<Array<{
    type: string;
    config: Record<string, unknown>;
  }>>(),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
  triggerIdx: { columns: [table.organization_id, table.trigger] },
}));

export const workflowExecutions = revopsSchema.table('workflow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  workflow_id: uuid('workflow_id').notNull(),
  deal_id: uuid('deal_id'),
  contact_id: uuid('contact_id'),
  triggered_at: timestamp('triggered_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('completed'), // completed, failed
  results: jsonb('results').$type<Record<string, unknown>>(),
  error: text('error'),
}, (table) => ({
  workflowIdx: { columns: [table.workflow_id] },
  dealIdx: { columns: [table.deal_id] },
}));
