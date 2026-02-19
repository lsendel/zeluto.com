import { eq, and, desc } from 'drizzle-orm';
import { enrichmentJobs } from '@mauntic/lead-intelligence-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type EnrichmentJobRow = typeof enrichmentJobs.$inferSelect;
export type EnrichmentJobInsert = typeof enrichmentJobs.$inferInsert;

export async function findJobById(
  db: NeonHttpDatabase,
  id: string,
): Promise<EnrichmentJobRow | null> {
  const [row] = await db
    .select()
    .from(enrichmentJobs)
    .where(eq(enrichmentJobs.id, id));
  return row ?? null;
}

export async function findJobsByContact(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  opts: { page: number; limit: number } = { page: 1, limit: 20 },
): Promise<{ data: EnrichmentJobRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const where = and(
    eq(enrichmentJobs.organization_id, orgId),
    eq(enrichmentJobs.contact_id, contactId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(enrichmentJobs)
      .where(where)
      .orderBy(desc(enrichmentJobs.created_at))
      .limit(opts.limit)
      .offset(offset),
    db
      .select({ count: enrichmentJobs.id })
      .from(enrichmentJobs)
      .where(where),
  ]);

  return { data, total: countResult.length };
}

export async function findPendingJobs(
  db: NeonHttpDatabase,
  orgId: string,
  limit = 10,
): Promise<EnrichmentJobRow[]> {
  return db
    .select()
    .from(enrichmentJobs)
    .where(and(
      eq(enrichmentJobs.organization_id, orgId),
      eq(enrichmentJobs.status, 'pending'),
    ))
    .limit(limit);
}

export async function createJob(
  db: NeonHttpDatabase,
  data: EnrichmentJobInsert,
): Promise<EnrichmentJobRow> {
  const [row] = await db
    .insert(enrichmentJobs)
    .values(data)
    .returning();
  return row;
}

export async function updateJob(
  db: NeonHttpDatabase,
  id: string,
  data: Partial<Omit<EnrichmentJobInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<EnrichmentJobRow | null> {
  const [row] = await db
    .update(enrichmentJobs)
    .set(data)
    .where(eq(enrichmentJobs.id, id))
    .returning();
  return row ?? null;
}
