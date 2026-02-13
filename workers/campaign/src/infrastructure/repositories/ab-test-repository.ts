import { eq, and } from 'drizzle-orm';
import { abTests } from '@mauntic/campaign-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type AbTestRow = typeof abTests.$inferSelect;
export type AbTestInsert = typeof abTests.$inferInsert;

export async function findAbTestById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<AbTestRow | null> {
  const [test] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.id, id), eq(abTests.organizationId, orgId)));
  return test ?? null;
}

export async function findAbTestsByCampaign(
  db: NeonHttpDatabase,
  orgId: string,
  campaignId: string,
): Promise<AbTestRow[]> {
  return db
    .select()
    .from(abTests)
    .where(and(eq(abTests.campaignId, campaignId), eq(abTests.organizationId, orgId)));
}

export async function createAbTest(
  db: NeonHttpDatabase,
  data: AbTestInsert,
): Promise<AbTestRow> {
  const [test] = await db.insert(abTests).values(data).returning();
  return test;
}

export async function updateAbTest(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Pick<AbTestInsert, 'winnerVariantId' | 'status' | 'completedAt' | 'updatedAt'>>,
): Promise<AbTestRow | null> {
  const [test] = await db
    .update(abTests)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(abTests.id, id), eq(abTests.organizationId, orgId)))
    .returning();
  return test ?? null;
}
