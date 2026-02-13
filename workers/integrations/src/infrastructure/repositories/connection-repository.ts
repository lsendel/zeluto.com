import { eq, and, desc, sql } from 'drizzle-orm';
import { connections } from '@mauntic/integrations-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ConnectionRow = typeof connections.$inferSelect;
export type ConnectionInsert = typeof connections.$inferInsert;

export async function findConnectionById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), eq(connections.organizationId, orgId)));
  return row ?? null;
}

export async function findAllConnections(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number },
): Promise<{ data: ConnectionRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = eq(connections.organizationId, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(connections)
      .where(where)
      .orderBy(desc(connections.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(connections)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createConnection(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    provider: string;
    name: string;
    config: unknown;
    status?: string;
  },
): Promise<ConnectionRow> {
  const [row] = await db
    .insert(connections)
    .values({
      organizationId: orgId,
      provider: data.provider,
      name: data.name,
      config: data.config,
      status: data.status ?? 'active',
    })
    .returning();
  return row;
}

export async function updateConnection(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{
    name: string;
    config: unknown;
    status: string;
    lastSyncAt: Date;
  }>,
): Promise<ConnectionRow | null> {
  const [row] = await db
    .update(connections)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(connections.id, id), eq(connections.organizationId, orgId)))
    .returning();
  return row ?? null;
}

export async function deleteConnection(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(connections)
    .where(and(eq(connections.id, id), eq(connections.organizationId, orgId)))
    .returning({ id: connections.id });
  return result.length > 0;
}
