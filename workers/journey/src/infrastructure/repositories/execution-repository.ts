import {
  execution_logs,
  journey_executions,
  step_executions,
} from '@mauntic/journey-domain/drizzle';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ExecutionRow = typeof journey_executions.$inferSelect;
export type ExecutionInsert = typeof journey_executions.$inferInsert;
export type StepExecutionRow = typeof step_executions.$inferSelect;
export type StepExecutionInsert = typeof step_executions.$inferInsert;
export type ExecutionLogRow = typeof execution_logs.$inferSelect;
export type ExecutionLogInsert = typeof execution_logs.$inferInsert;

// ---- Journey Executions ----

export async function findExecutionById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ExecutionRow | null> {
  const [execution] = await db
    .select()
    .from(journey_executions)
    .where(
      and(
        eq(journey_executions.id, id),
        eq(journey_executions.organization_id, orgId),
      ),
    );
  return execution ?? null;
}

export async function findExecutionsByJourneyId(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
  opts: { page: number; limit: number; status?: string; contactId?: string },
): Promise<{ data: ExecutionRow[]; total: number }> {
  const { page, limit, status, contactId } = opts;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(journey_executions.journey_id, journeyId),
    eq(journey_executions.organization_id, orgId),
  ];

  if (status) {
    conditions.push(eq(journey_executions.status, status));
  }
  if (contactId) {
    conditions.push(eq(journey_executions.contact_id, contactId));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(journey_executions)
      .where(where)
      .orderBy(desc(journey_executions.started_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(journey_executions)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function findActiveExecutionForContact(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
  contactId: string,
): Promise<ExecutionRow | null> {
  const [execution] = await db
    .select()
    .from(journey_executions)
    .where(
      and(
        eq(journey_executions.journey_id, journeyId),
        eq(journey_executions.contact_id, contactId),
        eq(journey_executions.organization_id, orgId),
        eq(journey_executions.status, 'active'),
      ),
    );
  return execution ?? null;
}

export async function createExecution(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ExecutionInsert, 'id' | 'organization_id' | 'started_at'>,
): Promise<ExecutionRow> {
  const [execution] = await db
    .insert(journey_executions)
    .values({ ...data, organization_id: orgId })
    .returning();
  return execution;
}

export async function updateExecution(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<ExecutionInsert, 'id' | 'organization_id' | 'started_at'>>,
): Promise<ExecutionRow | null> {
  const [execution] = await db
    .update(journey_executions)
    .set(data)
    .where(
      and(
        eq(journey_executions.id, id),
        eq(journey_executions.organization_id, orgId),
      ),
    )
    .returning();
  return execution ?? null;
}

export async function findStaleExecutions(
  db: NeonHttpDatabase,
  staleBeforeDate: Date,
): Promise<ExecutionRow[]> {
  return db
    .select()
    .from(journey_executions)
    .where(
      and(
        eq(journey_executions.status, 'active'),
        lt(journey_executions.started_at, staleBeforeDate),
      ),
    );
}

export async function countExecutionsByStatus(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
): Promise<Record<string, number>> {
  const results = await db
    .select({
      status: journey_executions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(journey_executions)
    .where(
      and(
        eq(journey_executions.journey_id, journeyId),
        eq(journey_executions.organization_id, orgId),
      ),
    )
    .groupBy(journey_executions.status);

  const counts: Record<string, number> = {};
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

// ---- Step Executions ----

export async function findStepExecutionsByExecutionId(
  db: NeonHttpDatabase,
  orgId: string,
  executionId: string,
): Promise<StepExecutionRow[]> {
  return db
    .select()
    .from(step_executions)
    .where(
      and(
        eq(step_executions.execution_id, executionId),
        eq(step_executions.organization_id, orgId),
      ),
    );
}

export async function findStepExecutionById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<StepExecutionRow | null> {
  const [stepExec] = await db
    .select()
    .from(step_executions)
    .where(
      and(
        eq(step_executions.id, id),
        eq(step_executions.organization_id, orgId),
      ),
    );
  return stepExec ?? null;
}

export async function createStepExecution(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<StepExecutionInsert, 'id' | 'organization_id'>,
): Promise<StepExecutionRow> {
  const [stepExec] = await db
    .insert(step_executions)
    .values({ ...data, organization_id: orgId })
    .returning();
  return stepExec;
}

export async function updateStepExecution(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<StepExecutionInsert, 'id' | 'organization_id'>>,
): Promise<StepExecutionRow | null> {
  const [stepExec] = await db
    .update(step_executions)
    .set(data)
    .where(
      and(
        eq(step_executions.id, id),
        eq(step_executions.organization_id, orgId),
      ),
    )
    .returning();
  return stepExec ?? null;
}

// ---- Execution Logs ----

export async function createExecutionLog(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ExecutionLogInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<ExecutionLogRow> {
  const [log] = await db
    .insert(execution_logs)
    .values({ ...data, organization_id: orgId })
    .returning();
  return log;
}

export async function findExecutionLogs(
  db: NeonHttpDatabase,
  orgId: string,
  executionId: string,
): Promise<ExecutionLogRow[]> {
  return db
    .select()
    .from(execution_logs)
    .where(
      and(
        eq(execution_logs.execution_id, executionId),
        eq(execution_logs.organization_id, orgId),
      ),
    )
    .orderBy(desc(execution_logs.created_at));
}
