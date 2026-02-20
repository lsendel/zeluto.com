import { activities } from '@mauntic/revops-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ActivityRow = typeof activities.$inferSelect;
export type ActivityInsert = typeof activities.$inferInsert;

export async function findActivityById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ActivityRow | null> {
  const [row] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.organization_id, orgId)));
  return row ?? null;
}

export async function findActivitiesByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<ActivityRow[]> {
  return db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.organization_id, orgId),
        eq(activities.contact_id, contactId),
      ),
    )
    .orderBy(desc(activities.created_at));
}

export async function findActivitiesByDeal(
  db: NeonHttpDatabase,
  orgId: string,
  dealId: string,
): Promise<ActivityRow[]> {
  return db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.organization_id, orgId),
        eq(activities.deal_id, dealId),
      ),
    )
    .orderBy(desc(activities.created_at));
}

export async function createActivity(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ActivityInsert, 'organization_id'>,
): Promise<ActivityRow> {
  const [row] = await db
    .insert(activities)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function countActivitiesByType(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<Array<{ type: string; count: number }>> {
  const results = await db
    .select({
      type: activities.type,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .where(eq(activities.organization_id, orgId))
    .groupBy(activities.type);
  return results.map((r) => ({ type: r.type, count: Number(r.count) }));
}
