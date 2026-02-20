import {
  journey_step_connections,
  journey_steps,
} from '@mauntic/journey-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type StepRow = typeof journey_steps.$inferSelect;
export type StepInsert = typeof journey_steps.$inferInsert;
export type ConnectionRow = typeof journey_step_connections.$inferSelect;
export type ConnectionInsert = typeof journey_step_connections.$inferInsert;

// ---- Steps ----

export async function findStepById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<StepRow | null> {
  const [step] = await db
    .select()
    .from(journey_steps)
    .where(
      and(eq(journey_steps.id, id), eq(journey_steps.organization_id, orgId)),
    );
  return step ?? null;
}

export async function findStepsByVersionId(
  db: NeonHttpDatabase,
  orgId: string,
  versionId: string,
): Promise<StepRow[]> {
  return db
    .select()
    .from(journey_steps)
    .where(
      and(
        eq(journey_steps.journey_version_id, versionId),
        eq(journey_steps.organization_id, orgId),
      ),
    );
}

export async function createStep(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<StepInsert, 'id' | 'organization_id'>,
): Promise<StepRow> {
  const [step] = await db
    .insert(journey_steps)
    .values({ ...data, organization_id: orgId })
    .returning();
  return step;
}

export async function updateStep(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<
    Omit<StepInsert, 'id' | 'organization_id' | 'journey_version_id'>
  >,
): Promise<StepRow | null> {
  const [step] = await db
    .update(journey_steps)
    .set(data)
    .where(
      and(eq(journey_steps.id, id), eq(journey_steps.organization_id, orgId)),
    )
    .returning();
  return step ?? null;
}

export async function deleteStep(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(journey_steps)
    .where(
      and(eq(journey_steps.id, id), eq(journey_steps.organization_id, orgId)),
    )
    .returning({ id: journey_steps.id });
  return result.length > 0;
}

// ---- Connections ----

export async function findConnectionsByStepIds(
  db: NeonHttpDatabase,
  stepIds: string[],
): Promise<ConnectionRow[]> {
  if (stepIds.length === 0) return [];
  // Connections don't have org_id, so we rely on step ownership
  const results: ConnectionRow[] = [];
  for (const stepId of stepIds) {
    const conns = await db
      .select()
      .from(journey_step_connections)
      .where(eq(journey_step_connections.from_step_id, stepId));
    results.push(...conns);
  }
  return results;
}

export async function findConnectionById(
  db: NeonHttpDatabase,
  id: string,
): Promise<ConnectionRow | null> {
  const [conn] = await db
    .select()
    .from(journey_step_connections)
    .where(eq(journey_step_connections.id, id));
  return conn ?? null;
}

export async function createConnection(
  db: NeonHttpDatabase,
  data: Omit<ConnectionInsert, 'id'>,
): Promise<ConnectionRow> {
  const [conn] = await db
    .insert(journey_step_connections)
    .values(data)
    .returning();
  return conn;
}

export async function deleteConnection(
  db: NeonHttpDatabase,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(journey_step_connections)
    .where(eq(journey_step_connections.id, id))
    .returning({ id: journey_step_connections.id });
  return result.length > 0;
}

export async function deleteConnectionsByStepId(
  db: NeonHttpDatabase,
  stepId: string,
): Promise<void> {
  await db
    .delete(journey_step_connections)
    .where(eq(journey_step_connections.from_step_id, stepId));
  await db
    .delete(journey_step_connections)
    .where(eq(journey_step_connections.to_step_id, stepId));
}
