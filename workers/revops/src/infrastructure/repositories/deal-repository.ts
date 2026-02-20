import { deals } from '@mauntic/revops-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type DealRow = typeof deals.$inferSelect;
export type DealInsert = typeof deals.$inferInsert;

export async function findDealById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<DealRow | null> {
  const [row] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.organization_id, orgId)));
  return row ?? null;
}

export async function findDealsByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number } = { page: 1, limit: 20 },
): Promise<{ data: DealRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const where = eq(deals.organization_id, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(deals)
      .where(where)
      .orderBy(desc(deals.updated_at))
      .limit(opts.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(deals).where(where),
  ]);

  return { data, total: Number(countResult[0]?.count ?? 0) };
}

export async function findDealsByStage(
  db: NeonHttpDatabase,
  orgId: string,
  stage: string,
): Promise<DealRow[]> {
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.organization_id, orgId), eq(deals.stage, stage)))
    .orderBy(desc(deals.updated_at));
}

export async function findDealsByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<DealRow[]> {
  return db
    .select()
    .from(deals)
    .where(
      and(eq(deals.organization_id, orgId), eq(deals.contact_id, contactId)),
    )
    .orderBy(desc(deals.created_at));
}

export async function findDealsByRep(
  db: NeonHttpDatabase,
  orgId: string,
  repId: string,
): Promise<DealRow[]> {
  return db
    .select()
    .from(deals)
    .where(and(eq(deals.organization_id, orgId), eq(deals.assigned_rep, repId)))
    .orderBy(desc(deals.updated_at));
}

export async function createDeal(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<DealInsert, 'organization_id'>,
): Promise<DealRow> {
  const [row] = await db
    .insert(deals)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function updateDeal(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<DealInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<DealRow | null> {
  const [row] = await db
    .update(deals)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(deals.id, id), eq(deals.organization_id, orgId)))
    .returning();
  return row ?? null;
}

export async function countDealsByStage(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<Array<{ stage: string; count: number; totalValue: string }>> {
  const results = await db
    .select({
      stage: deals.stage,
      count: sql<number>`count(*)`,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(deals)
    .where(eq(deals.organization_id, orgId))
    .groupBy(deals.stage);
  return results.map((r) => ({
    stage: r.stage,
    count: Number(r.count),
    totalValue: r.totalValue,
  }));
}
