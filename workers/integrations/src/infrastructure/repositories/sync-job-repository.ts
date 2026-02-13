import { eq, and, desc, sql } from 'drizzle-orm';
import { syncJobs } from '@mauntic/integrations-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SyncJobRow = typeof syncJobs.$inferSelect;

export async function findSyncJobById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SyncJobRow | null> {
  const [row] = await db
    .select()
    .from(syncJobs)
    .where(and(eq(syncJobs.id, id), eq(syncJobs.organizationId, orgId)));
  return row ?? null;
}

export async function findSyncJobsByConnection(
  db: NeonHttpDatabase,
  orgId: string,
  connectionId: string,
  opts: { page: number; limit: number },
): Promise<{ data: SyncJobRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = and(
    eq(syncJobs.organizationId, orgId),
    eq(syncJobs.connectionId, connectionId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(syncJobs)
      .where(where)
      .orderBy(desc(syncJobs.startedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncJobs)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createSyncJob(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    connectionId: string;
    direction: string;
    entityType: string;
    status?: string;
  },
): Promise<SyncJobRow> {
  const [row] = await db
    .insert(syncJobs)
    .values({
      organizationId: orgId,
      connectionId: data.connectionId,
      direction: data.direction,
      entityType: data.entityType,
      status: data.status ?? 'pending',
      startedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateSyncJob(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{
    status: string;
    recordsProcessed: number;
    recordsFailed: number;
    error: string | null;
    completedAt: Date;
  }>,
): Promise<SyncJobRow | null> {
  const [row] = await db
    .update(syncJobs)
    .set(data)
    .where(and(eq(syncJobs.id, id), eq(syncJobs.organizationId, orgId)))
    .returning();
  return row ?? null;
}
