import {
  type FilterCriteria,
  Segment,
  type SegmentRepository,
} from '@mauntic/crm-domain';
import {
  contacts,
  segment_contacts,
  segments,
} from '@mauntic/crm-domain/drizzle';
import type {
  ContactId,
  OrganizationId,
  SegmentId,
} from '@mauntic/domain-kernel';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { buildFilterWhere } from '../../services/filter-engine.js';

export class DrizzleSegmentRepository implements SegmentRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: SegmentId,
  ): Promise<Segment | null> {
    const [row] = await this.db
      .select()
      .from(segments)
      .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Segment[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(segments)
        .where(eq(segments.organization_id, orgId))
        .orderBy(desc(segments.created_at))
        .limit(pagination.limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(segments)
        .where(eq(segments.organization_id, orgId)),
    ]);
    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: totalResult[0]?.total ?? 0,
    };
  }

  async save(segment: Segment): Promise<void> {
    const props = segment.toProps();
    const [existing] = await this.db
      .select({ id: segments.id })
      .from(segments)
      .where(eq(segments.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(segments)
        .set({
          name: props.name,
          description: props.description,
          filter_criteria: props.filterCriteria,
          contact_count: props.contactCount,
          updated_at: props.updatedAt,
        })
        .where(eq(segments.id, props.id));
    } else {
      await this.db.insert(segments).values({
        id: props.id,
        organization_id: props.organizationId,
        name: props.name,
        description: props.description,
        type: props.type,
        filter_criteria: props.filterCriteria,
        contact_count: props.contactCount,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: SegmentId): Promise<void> {
    await this.db
      .delete(segment_contacts)
      .where(eq(segment_contacts.segment_id, id));
    await this.db
      .delete(segments)
      .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)));
  }

  async addContacts(
    orgId: OrganizationId,
    segmentId: SegmentId,
    contactIds: ContactId[],
  ): Promise<void> {
    if (!contactIds.length) return;

    const validContacts = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, contactIds),
          eq(contacts.organization_id, orgId),
        ),
      );
    const validIds = new Set(validContacts.map((c) => c.id));

    const existingLinks = await this.db
      .select({ contact_id: segment_contacts.contact_id })
      .from(segment_contacts)
      .where(
        and(
          eq(segment_contacts.segment_id, segmentId),
          inArray(
            segment_contacts.contact_id,
            contactIds.filter((id) => validIds.has(id)),
          ),
        ),
      );
    const existingIds = new Set(existingLinks.map((l) => l.contact_id));

    const toInsert = contactIds.filter(
      (id) => validIds.has(id) && !existingIds.has(id),
    );
    if (toInsert.length > 0) {
      await this.db.insert(segment_contacts).values(
        toInsert.map((contactId) => ({
          segment_id: segmentId,
          contact_id: contactId,
        })),
      );
    }
  }

  async removeContacts(
    orgId: OrganizationId,
    segmentId: SegmentId,
    contactIds: ContactId[],
  ): Promise<void> {
    if (!contactIds.length) return;
    await this.db
      .delete(segment_contacts)
      .where(
        and(
          eq(segment_contacts.segment_id, segmentId),
          inArray(segment_contacts.contact_id, contactIds),
        ),
      );
  }

  async countMatchingContacts(
    orgId: OrganizationId,
    filterCriteria: FilterCriteria,
  ): Promise<number> {
    const where = buildFilterWhere(filterCriteria as any, orgId);
    const result = await this.db
      .select({ total: count() })
      .from(contacts)
      .where(where);
    return result[0]?.total ?? 0;
  }

  private mapToEntity(row: typeof segments.$inferSelect): Segment {
    return Segment.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description ?? null,
      type: row.type as 'static' | 'dynamic',
      filterCriteria: row.filter_criteria,
      contactCount: row.contact_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
