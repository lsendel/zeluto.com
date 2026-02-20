import {
  contactActivity,
  eventAggregates,
} from '@mauntic/analytics-domain/drizzle';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ContactActivityRow = typeof contactActivity.$inferSelect;
export type EventAggregateRow = typeof eventAggregates.$inferSelect;

export async function logEvent(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    contactId: string;
    eventType: string;
    eventSource?: string | null;
    eventData?: Record<string, unknown> | null;
  },
): Promise<ContactActivityRow> {
  const [row] = await db
    .insert(contactActivity)
    .values({
      organizationId: orgId,
      contactId: data.contactId,
      eventType: data.eventType,
      eventSource: data.eventSource ?? null,
      eventData: data.eventData ?? null,
    })
    .returning();
  return row;
}

export async function queryEvents(
  db: NeonHttpDatabase,
  orgId: string,
  opts: {
    page: number;
    limit: number;
    eventType?: string;
    contactId?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<{ data: ContactActivityRow[]; total: number }> {
  const { page, limit, eventType, contactId, startDate, endDate } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(contactActivity.organizationId, orgId)];
  if (eventType) conditions.push(eq(contactActivity.eventType, eventType));
  if (contactId) conditions.push(eq(contactActivity.contactId, contactId));
  if (startDate)
    conditions.push(gte(contactActivity.createdAt, new Date(startDate)));
  if (endDate)
    conditions.push(lte(contactActivity.createdAt, new Date(endDate)));

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(contactActivity)
      .where(where)
      .orderBy(desc(contactActivity.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactActivity)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function queryAggregates(
  db: NeonHttpDatabase,
  orgId: string,
  opts: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
  },
): Promise<EventAggregateRow[]> {
  const conditions = [eq(eventAggregates.organizationId, orgId)];
  if (opts.eventType)
    conditions.push(eq(eventAggregates.eventType, opts.eventType));
  if (opts.startDate)
    conditions.push(gte(eventAggregates.date, opts.startDate));
  if (opts.endDate) conditions.push(lte(eventAggregates.date, opts.endDate));

  return db
    .select()
    .from(eventAggregates)
    .where(and(...conditions))
    .orderBy(desc(eventAggregates.date));
}
