import { contact_tags, tags } from '@mauntic/crm-domain/drizzle';
import { and, eq, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type TagRow = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

export async function findTagById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<TagRow | null> {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.organization_id, orgId)));
  return tag ?? null;
}

export async function findAllTags(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<TagRow[]> {
  return db
    .select()
    .from(tags)
    .where(eq(tags.organization_id, orgId))
    .orderBy(tags.name);
}

export async function createTag(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<TagInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<TagRow> {
  const [tag] = await db
    .insert(tags)
    .values({ ...data, organization_id: orgId })
    .returning();
  return tag;
}

export async function deleteTag(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  // Remove junction rows first
  await db.delete(contact_tags).where(eq(contact_tags.tag_id, id));

  const result = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.organization_id, orgId)))
    .returning({ id: tags.id });
  return result.length > 0;
}

export async function tagContact(
  db: NeonHttpDatabase,
  contactId: string,
  tagId: string,
): Promise<void> {
  await db
    .insert(contact_tags)
    .values({ contact_id: contactId, tag_id: tagId })
    .onConflictDoNothing();
}

export async function untagContact(
  db: NeonHttpDatabase,
  contactId: string,
  tagId: string,
): Promise<void> {
  await db
    .delete(contact_tags)
    .where(
      and(
        eq(contact_tags.contact_id, contactId),
        eq(contact_tags.tag_id, tagId),
      ),
    );
}

export async function findTagsByContact(
  db: NeonHttpDatabase,
  contactId: string,
): Promise<TagRow[]> {
  const junctions = await db
    .select({ tag_id: contact_tags.tag_id })
    .from(contact_tags)
    .where(eq(contact_tags.contact_id, contactId));

  if (junctions.length === 0) return [];

  const tagIds = junctions.map((j) => j.tag_id);
  return db.select().from(tags).where(inArray(tags.id, tagIds));
}
