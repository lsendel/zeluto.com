import { segment_contacts, segments } from '@mauntic/crm-domain/drizzle';
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type SegmentRow = typeof segments.$inferSelect;
export type SegmentInsert = typeof segments.$inferInsert;

export async function findSegmentById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<SegmentRow | null> {
  const [segment] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)));
  return segment ?? null;
}

export async function findAllSegments(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: SegmentRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(segments.organization_id, orgId)];

  if (search) {
    conditions.push(ilike(segments.name, `%${search}%`));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(segments)
      .where(where)
      .orderBy(desc(segments.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(segments)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createSegment(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<
    SegmentInsert,
    'id' | 'organization_id' | 'created_at' | 'updated_at'
  >,
): Promise<SegmentRow> {
  const [segment] = await db
    .insert(segments)
    .values({ ...data, organization_id: orgId })
    .returning();
  return segment;
}

export async function updateSegment(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<SegmentInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<SegmentRow | null> {
  const [segment] = await db
    .update(segments)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)))
    .returning();
  return segment ?? null;
}

export async function deleteSegment(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .delete(segment_contacts)
      .where(eq(segment_contacts.segment_id, id));

    const result = await tx
      .delete(segments)
      .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)))
      .returning({ id: segments.id });
    return result.length > 0;
  });
}

export async function addContactsToSegment(
  db: NeonHttpDatabase,
  segmentId: string,
  contactIds: string[],
): Promise<number> {
  if (contactIds.length === 0) return 0;

  return db.transaction(async (tx) => {
    const values = contactIds.map((contactId) => ({
      segment_id: segmentId,
      contact_id: contactId,
    }));

    const result = await tx
      .insert(segment_contacts)
      .values(values)
      .onConflictDoNothing()
      .returning();

    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(segment_contacts)
      .where(eq(segment_contacts.segment_id, segmentId));

    await tx
      .update(segments)
      .set({ contact_count: countResult?.count ?? 0, updated_at: new Date() })
      .where(eq(segments.id, segmentId));

    return result.length;
  });
}

export async function removeContactsFromSegment(
  db: NeonHttpDatabase,
  segmentId: string,
  contactIds: string[],
): Promise<number> {
  if (contactIds.length === 0) return 0;

  const result = await db
    .delete(segment_contacts)
    .where(
      and(
        eq(segment_contacts.segment_id, segmentId),
        inArray(segment_contacts.contact_id, contactIds),
      ),
    )
    .returning();

  // Update contact_count on the segment
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(segment_contacts)
    .where(eq(segment_contacts.segment_id, segmentId));

  await db
    .update(segments)
    .set({ contact_count: countResult?.count ?? 0, updated_at: new Date() })
    .where(eq(segments.id, segmentId));

  return result.length;
}
