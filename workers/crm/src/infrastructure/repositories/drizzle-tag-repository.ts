import { Tag, type TagRepository } from '@mauntic/crm-domain';
import { contact_tags, tags } from '@mauntic/crm-domain/drizzle';
import type { ContactId, OrganizationId } from '@mauntic/domain-kernel';
import { and, count, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: OrganizationId, id: string): Promise<Tag | null> {
    const [row] = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.organization_id, orgId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByName(orgId: OrganizationId, name: string): Promise<Tag | null> {
    const [row] = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.organization_id, orgId), eq(tags.name, name)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Tag[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(tags)
        .where(eq(tags.organization_id, orgId))
        .orderBy(tags.name)
        .limit(pagination.limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(tags)
        .where(eq(tags.organization_id, orgId)),
    ]);
    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: totalResult[0]?.total ?? 0,
    };
  }

  async save(tag: Tag): Promise<void> {
    const props = tag.toProps();
    const [existing] = await this.db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(tags)
        .set({ name: props.name, color: props.color })
        .where(eq(tags.id, props.id));
    } else {
      await this.db.insert(tags).values({
        id: props.id,
        organization_id: props.organizationId,
        name: props.name,
        color: props.color,
        created_at: props.createdAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: string): Promise<void> {
    await this.db.delete(contact_tags).where(eq(contact_tags.tag_id, id));
    await this.db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.organization_id, orgId)));
  }

  async tagContact(
    orgId: OrganizationId,
    tagId: string,
    contactId: ContactId,
  ): Promise<void> {
    // Check if already tagged
    const [existing] = await this.db
      .select({ id: contact_tags.id })
      .from(contact_tags)
      .where(
        and(
          eq(contact_tags.tag_id, tagId),
          eq(contact_tags.contact_id, contactId),
        ),
      )
      .limit(1);
    if (existing) return;

    await this.db.insert(contact_tags).values({
      tag_id: tagId,
      contact_id: contactId,
    });
  }

  async untagContact(
    orgId: OrganizationId,
    tagId: string,
    contactId: ContactId,
  ): Promise<void> {
    await this.db
      .delete(contact_tags)
      .where(
        and(
          eq(contact_tags.tag_id, tagId),
          eq(contact_tags.contact_id, contactId),
        ),
      );
  }

  async findByContact(
    orgId: OrganizationId,
    contactId: ContactId,
  ): Promise<Tag[]> {
    const rows = await this.db
      .select({ tag: tags })
      .from(contact_tags)
      .innerJoin(tags, eq(contact_tags.tag_id, tags.id))
      .where(
        and(
          eq(contact_tags.contact_id, contactId),
          eq(tags.organization_id, orgId),
        ),
      );
    return rows.map((r) => this.mapToEntity(r.tag));
  }

  private mapToEntity(row: typeof tags.$inferSelect): Tag {
    return Tag.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      color: row.color ?? null,
      createdAt: row.created_at,
    });
  }
}
