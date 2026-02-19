import { eq, and, desc } from 'drizzle-orm';
import { prospects } from '@mauntic/revops-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ProspectRow = typeof prospects.$inferSelect;
export type ProspectInsert = typeof prospects.$inferInsert;

export async function findProspectByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
): Promise<ProspectRow | null> {
  const [row] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.organization_id, orgId), eq(prospects.contact_id, contactId)));
  return row ?? null;
}

export async function findProspectsByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<ProspectRow[]> {
  return db
    .select()
    .from(prospects)
    .where(eq(prospects.organization_id, orgId))
    .orderBy(desc(prospects.updated_at));
}

export async function findProspectsByRecommendation(
  db: NeonHttpDatabase,
  orgId: string,
  recommendation: string,
): Promise<ProspectRow[]> {
  return db
    .select()
    .from(prospects)
    .where(and(eq(prospects.organization_id, orgId), eq(prospects.recommendation, recommendation)))
    .orderBy(desc(prospects.qualification_score));
}

export async function upsertProspect(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ProspectInsert, 'organization_id'>,
): Promise<ProspectRow> {
  const [row] = await db
    .insert(prospects)
    .values({ ...data, organization_id: orgId })
    .onConflictDoUpdate({
      target: prospects.id,
      set: { ...data, updated_at: new Date() },
    })
    .returning();
  return row;
}
