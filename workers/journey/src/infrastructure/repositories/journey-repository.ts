import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { journeys } from '@mauntic/journey-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type JourneyRow = typeof journeys.$inferSelect;
export type JourneyInsert = typeof journeys.$inferInsert;

export async function findJourneyById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<JourneyRow | null> {
  const [journey] = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.organization_id, orgId)));
  return journey ?? null;
}

export async function findAllJourneys(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string; status?: string },
): Promise<{ data: JourneyRow[]; total: number }> {
  const { page, limit, search, status } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(journeys.organization_id, orgId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(journeys.name, pattern),
        ilike(journeys.description, pattern),
      )!,
    );
  }

  if (status) {
    conditions.push(eq(journeys.status, status));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(journeys)
      .where(where)
      .orderBy(desc(journeys.updated_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(journeys)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createJourney(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<JourneyInsert, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
): Promise<JourneyRow> {
  const [journey] = await db
    .insert(journeys)
    .values({ ...data, organization_id: orgId })
    .returning();
  return journey;
}

export async function updateJourney(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<JourneyInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<JourneyRow | null> {
  const [journey] = await db
    .update(journeys)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(journeys.id, id), eq(journeys.organization_id, orgId)))
    .returning();
  return journey ?? null;
}

export async function deleteJourney(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.organization_id, orgId)))
    .returning({ id: journeys.id });
  return result.length > 0;
}

export async function findJourneysByStatus(
  db: NeonHttpDatabase,
  orgId: string,
  status: string,
): Promise<JourneyRow[]> {
  return db
    .select()
    .from(journeys)
    .where(and(eq(journeys.organization_id, orgId), eq(journeys.status, status)))
    .orderBy(desc(journeys.updated_at));
}

export async function findActiveJourneys(
  db: NeonHttpDatabase,
): Promise<JourneyRow[]> {
  return db
    .select()
    .from(journeys)
    .where(eq(journeys.status, 'active'));
}
