import { pointLog, pointRules } from '@mauntic/campaign-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type PointRuleRow = typeof pointRules.$inferSelect;
export type PointRuleInsert = typeof pointRules.$inferInsert;
export type PointLogRow = typeof pointLog.$inferSelect;
export type PointLogInsert = typeof pointLog.$inferInsert;

export async function findPointRuleById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<PointRuleRow | null> {
  const [rule] = await db
    .select()
    .from(pointRules)
    .where(and(eq(pointRules.id, id), eq(pointRules.organizationId, orgId)));
  return rule ?? null;
}

export async function findPointRulesByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number },
): Promise<{ data: PointRuleRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;

  const where = eq(pointRules.organizationId, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(pointRules)
      .where(where)
      .orderBy(desc(pointRules.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pointRules)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function findPointRulesByEventType(
  db: NeonHttpDatabase,
  orgId: string,
  eventType: string,
): Promise<PointRuleRow[]> {
  return db
    .select()
    .from(pointRules)
    .where(
      and(
        eq(pointRules.organizationId, orgId),
        eq(pointRules.eventType, eventType),
        eq(pointRules.isActive, true),
      ),
    );
}

export async function createPointRule(
  db: NeonHttpDatabase,
  data: PointRuleInsert,
): Promise<PointRuleRow> {
  const [rule] = await db.insert(pointRules).values(data).returning();
  return rule;
}

export async function updatePointRule(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Pick<PointRuleInsert, 'points' | 'description' | 'isActive'>>,
): Promise<PointRuleRow | null> {
  const [rule] = await db
    .update(pointRules)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(pointRules.id, id), eq(pointRules.organizationId, orgId)))
    .returning();
  return rule ?? null;
}

export async function deletePointRule(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(pointRules)
    .where(and(eq(pointRules.id, id), eq(pointRules.organizationId, orgId)))
    .returning({ id: pointRules.id });
  return result.length > 0;
}

export async function createPointLogEntry(
  db: NeonHttpDatabase,
  data: PointLogInsert,
): Promise<PointLogRow> {
  const [entry] = await db.insert(pointLog).values(data).returning();
  return entry;
}

export async function findPointLogByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  opts: { page: number; limit: number },
): Promise<{ data: PointLogRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;

  const where = and(
    eq(pointLog.organizationId, orgId),
    eq(pointLog.contactId, contactId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(pointLog)
      .where(where)
      .orderBy(desc(pointLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pointLog)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function getContactTotalPoints(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<number> {
  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${pointLog.points}), 0)::int` })
    .from(pointLog)
    .where(
      and(
        eq(pointLog.organizationId, orgId),
        eq(pointLog.contactId, contactId),
      ),
    );
  return result?.total ?? 0;
}
