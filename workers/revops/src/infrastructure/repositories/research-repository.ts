import { researchInsights, researchJobs } from '@mauntic/revops-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ResearchJobRow = typeof researchJobs.$inferSelect;
export type ResearchJobInsert = typeof researchJobs.$inferInsert;
export type ResearchInsightRow = typeof researchInsights.$inferSelect;
export type ResearchInsightInsert = typeof researchInsights.$inferInsert;

export async function findJobById(
  db: NeonHttpDatabase,
  id: string,
): Promise<ResearchJobRow | null> {
  const [row] = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.id, id));
  return row ?? null;
}

export async function findJobsByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<ResearchJobRow[]> {
  return db
    .select()
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.organization_id, orgId),
        eq(researchJobs.contact_id, contactId),
      ),
    )
    .orderBy(desc(researchJobs.created_at));
}

export async function createJob(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ResearchJobInsert, 'organization_id'>,
): Promise<ResearchJobRow> {
  const [row] = await db
    .insert(researchJobs)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function updateJob(
  db: NeonHttpDatabase,
  id: string,
  data: Partial<
    Omit<ResearchJobInsert, 'id' | 'organization_id' | 'created_at'>
  >,
): Promise<ResearchJobRow | null> {
  const [row] = await db
    .update(researchJobs)
    .set(data)
    .where(eq(researchJobs.id, id))
    .returning();
  return row ?? null;
}

export async function findInsightsByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<ResearchInsightRow[]> {
  return db
    .select()
    .from(researchInsights)
    .where(
      and(
        eq(researchInsights.organization_id, orgId),
        eq(researchInsights.contact_id, contactId),
      ),
    )
    .orderBy(desc(researchInsights.relevance));
}

export async function createInsight(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ResearchInsightInsert, 'organization_id'>,
): Promise<ResearchInsightRow> {
  const [row] = await db
    .insert(researchInsights)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function createInsights(
  db: NeonHttpDatabase,
  orgId: string,
  data: Array<Omit<ResearchInsightInsert, 'organization_id'>>,
): Promise<ResearchInsightRow[]> {
  if (data.length === 0) return [];
  return db
    .insert(researchInsights)
    .values(data.map((d) => ({ ...d, organization_id: orgId })))
    .returning();
}
