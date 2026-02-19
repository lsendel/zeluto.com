import { eq, and, desc } from 'drizzle-orm';
import { workflows, workflowExecutions } from '@mauntic/revops-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowInsert = typeof workflows.$inferInsert;
export type WorkflowExecutionRow = typeof workflowExecutions.$inferSelect;
export type WorkflowExecutionInsert = typeof workflowExecutions.$inferInsert;

export async function findWorkflowById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.organization_id, orgId)));
  return row ?? null;
}

export async function findWorkflowsByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<WorkflowRow[]> {
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.organization_id, orgId))
    .orderBy(desc(workflows.updated_at));
}

export async function findWorkflowsByTrigger(
  db: NeonHttpDatabase,
  orgId: string,
  trigger: string,
): Promise<WorkflowRow[]> {
  return db
    .select()
    .from(workflows)
    .where(and(
      eq(workflows.organization_id, orgId),
      eq(workflows.trigger, trigger),
      eq(workflows.enabled, true),
    ));
}

export async function createWorkflow(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<WorkflowInsert, 'organization_id'>,
): Promise<WorkflowRow> {
  const [row] = await db
    .insert(workflows)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function updateWorkflow(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<WorkflowInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .update(workflows)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(workflows.id, id), eq(workflows.organization_id, orgId)))
    .returning();
  return row ?? null;
}

export async function recordExecution(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<WorkflowExecutionInsert, 'organization_id'>,
): Promise<WorkflowExecutionRow> {
  const [row] = await db
    .insert(workflowExecutions)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function findExecutionsByWorkflow(
  db: NeonHttpDatabase,
  orgId: string,
  workflowId: string,
): Promise<WorkflowExecutionRow[]> {
  return db
    .select()
    .from(workflowExecutions)
    .where(and(
      eq(workflowExecutions.organization_id, orgId),
      eq(workflowExecutions.workflow_id, workflowId),
    ))
    .orderBy(desc(workflowExecutions.triggered_at));
}
