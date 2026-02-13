import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { contacts } from '@mauntic/crm-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;

export async function findContactById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<ContactRow | null> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organization_id, orgId)));
  return contact ?? null;
}

export async function findContactByEmail(
  db: NeonHttpDatabase,
  orgId: string,
  email: string,
): Promise<ContactRow | null> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.email, email), eq(contacts.organization_id, orgId)));
  return contact ?? null;
}

export async function findAllContacts(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: ContactRow[]; total: number }> {
  const { page, limit, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(contacts.organization_id, orgId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(contacts.email, pattern),
        ilike(contacts.first_name, pattern),
        ilike(contacts.last_name, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createContact(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ContactInsert, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
): Promise<ContactRow> {
  const [contact] = await db
    .insert(contacts)
    .values({ ...data, organization_id: orgId })
    .returning();
  return contact;
}

export async function updateContact(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<ContactInsert, 'id' | 'organization_id' | 'created_at'>>,
): Promise<ContactRow | null> {
  const [contact] = await db
    .update(contacts)
    .set({ ...data, updated_at: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.organization_id, orgId)))
    .returning();
  return contact ?? null;
}

export async function deleteContact(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organization_id, orgId)))
    .returning({ id: contacts.id });
  return result.length > 0;
}

export async function countContactsByOrg(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.organization_id, orgId));
  return result?.count ?? 0;
}
