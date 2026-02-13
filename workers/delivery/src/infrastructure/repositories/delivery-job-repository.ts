import { eq, and, desc, sql } from 'drizzle-orm';
import { delivery_jobs } from '@mauntic/delivery-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type DeliveryJobRow = typeof delivery_jobs.$inferSelect;
export type DeliveryJobInsert = typeof delivery_jobs.$inferInsert;

export async function findJobById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<DeliveryJobRow | null> {
  const [job] = await db
    .select()
    .from(delivery_jobs)
    .where(and(eq(delivery_jobs.id, id), eq(delivery_jobs.organization_id, orgId)));
  return job ?? null;
}

export async function findAllJobs(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; channel?: string; status?: string },
): Promise<{ data: DeliveryJobRow[]; total: number }> {
  const { page, limit, channel, status } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(delivery_jobs.organization_id, orgId)];
  if (channel) conditions.push(eq(delivery_jobs.channel, channel));
  if (status) conditions.push(eq(delivery_jobs.status, status));

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(delivery_jobs)
      .where(where)
      .orderBy(desc(delivery_jobs.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(delivery_jobs)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createJob(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<DeliveryJobInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<DeliveryJobRow> {
  const [job] = await db
    .insert(delivery_jobs)
    .values({ ...data, organization_id: orgId })
    .returning();
  return job;
}

export async function updateJob(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Pick<DeliveryJobInsert, 'status' | 'sent_count' | 'failed_count' | 'completed_at'>>,
): Promise<DeliveryJobRow | null> {
  const [job] = await db
    .update(delivery_jobs)
    .set(data)
    .where(and(eq(delivery_jobs.id, id), eq(delivery_jobs.organization_id, orgId)))
    .returning();
  return job ?? null;
}

export async function findJobByIdempotencyKey(
  db: NeonHttpDatabase,
  orgId: string,
  key: string,
): Promise<DeliveryJobRow | null> {
  const [job] = await db
    .select()
    .from(delivery_jobs)
    .where(and(eq(delivery_jobs.idempotency_key, key), eq(delivery_jobs.organization_id, orgId)));
  return job ?? null;
}
