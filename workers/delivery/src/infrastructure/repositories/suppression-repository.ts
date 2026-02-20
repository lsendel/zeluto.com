import { suppressions } from '@mauntic/delivery-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SuppressionRow = typeof suppressions.$inferSelect;
export type SuppressionInsert = typeof suppressions.$inferInsert;

export async function findSuppressionById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SuppressionRow | null> {
  const [suppression] = await db
    .select()
    .from(suppressions)
    .where(
      and(eq(suppressions.id, id), eq(suppressions.organization_id, orgId)),
    );
  return suppression ?? null;
}

export async function findAllSuppressions(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; reason?: string },
): Promise<{ data: SuppressionRow[]; total: number }> {
  const { page, limit, reason } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(suppressions.organization_id, orgId)];
  if (reason) conditions.push(eq(suppressions.reason, reason));

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(suppressions)
      .where(where)
      .orderBy(desc(suppressions.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(suppressions)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function isEmailSuppressed(
  db: NeonHttpDatabase,
  orgId: string,
  email: string,
): Promise<{ suppressed: boolean; reason: string | null }> {
  const [row] = await db
    .select({ reason: suppressions.reason })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.organization_id, orgId),
        eq(suppressions.email, email.toLowerCase()),
      ),
    )
    .limit(1);
  if (row) {
    return { suppressed: true, reason: row.reason };
  }
  return { suppressed: false, reason: null };
}

export async function createSuppression(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<SuppressionInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<SuppressionRow> {
  const [suppression] = await db
    .insert(suppressions)
    .values({
      ...data,
      email: data.email.toLowerCase(),
      organization_id: orgId,
    })
    .returning();
  return suppression;
}

export async function deleteSuppression(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(suppressions)
    .where(
      and(eq(suppressions.id, id), eq(suppressions.organization_id, orgId)),
    )
    .returning({ id: suppressions.id });
  return result.length > 0;
}
