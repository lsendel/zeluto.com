import { eq, and, desc, sql } from 'drizzle-orm';
import { delivery_events } from '@mauntic/delivery-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type DeliveryEventRow = typeof delivery_events.$inferSelect;
export type DeliveryEventInsert = typeof delivery_events.$inferInsert;

export async function findEventsByJobId(
  db: NeonHttpDatabase,
  orgId: string,
  jobId: string,
  opts: { page: number; limit: number },
): Promise<{ data: DeliveryEventRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;

  const where = and(
    eq(delivery_events.organization_id, orgId),
    eq(delivery_events.job_id, jobId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(delivery_events)
      .where(where)
      .orderBy(desc(delivery_events.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(delivery_events)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function findEventsByContactId(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  opts: { page: number; limit: number },
): Promise<{ data: DeliveryEventRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;

  const where = and(
    eq(delivery_events.organization_id, orgId),
    eq(delivery_events.contact_id, contactId),
  );

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(delivery_events)
      .where(where)
      .orderBy(desc(delivery_events.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(delivery_events)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createEvent(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<DeliveryEventInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<DeliveryEventRow> {
  const [event] = await db
    .insert(delivery_events)
    .values({ ...data, organization_id: orgId })
    .returning();
  return event;
}

export async function findEventByProviderMessageId(
  db: NeonHttpDatabase,
  providerMessageId: string,
): Promise<DeliveryEventRow | null> {
  const [event] = await db
    .select()
    .from(delivery_events)
    .where(eq(delivery_events.provider_message_id, providerMessageId))
    .limit(1);
  return event ?? null;
}
