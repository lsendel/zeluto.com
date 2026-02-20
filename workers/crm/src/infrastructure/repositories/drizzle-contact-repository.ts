import {
  Contact,
  type ContactProps,
  type ContactRepository,
} from '@mauntic/crm-domain';
import {
  contacts,
  segment_contacts,
  segments,
} from '@mauntic/crm-domain/drizzle';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  buildFilterWhere,
  type FilterCriteria,
} from '../../services/filter-engine.js';

export class SegmentNotFoundError extends Error {
  constructor(segmentId: string) {
    super(`SEGMENT_NOT_FOUND:${segmentId}`);
    this.name = 'SegmentNotFoundError';
  }
}

export class DrizzleContactRepository implements ContactRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: string, id: string): Promise<Contact | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.organization_id, orgId)));

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findByEmail(orgId: string, email: string): Promise<Contact | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.email, email), eq(contacts.organization_id, orgId)),
      );

    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Contact[]; total: number }> {
    const { page, limit, search } = pagination;
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

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(contacts)
        .where(where)
        .orderBy(desc(contacts.created_at))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(where),
    ]);

    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async findBySegment(
    orgId: string,
    segmentId: string,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: Contact[]; total: number; nextOffset: number | null }> {
    const limit = Math.max(1, Math.min(pagination.limit, 1000));
    const offset = Math.max(0, pagination.offset);

    const [segment] = await this.db
      .select({
        id: segments.id,
        type: segments.type,
        filterCriteria: segments.filter_criteria,
      })
      .from(segments)
      .where(
        and(eq(segments.id, segmentId), eq(segments.organization_id, orgId)),
      )
      .limit(1);

    if (!segment) {
      throw new SegmentNotFoundError(segmentId);
    }

    if (segment.type === 'static') {
      return this.fetchStaticSegmentContacts(orgId, segmentId, {
        offset,
        limit,
      });
    }

    const criteria = (segment.filterCriteria as FilterCriteria | null) ?? null;
    return this.fetchDynamicSegmentContacts(orgId, criteria, { offset, limit });
  }

  private async fetchStaticSegmentContacts(
    orgId: string,
    segmentId: string,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: Contact[]; total: number; nextOffset: number | null }> {
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(segment_contacts)
      .innerJoin(contacts, eq(segment_contacts.contact_id, contacts.id))
      .where(
        and(
          eq(segment_contacts.segment_id, segmentId),
          eq(contacts.organization_id, orgId),
        ),
      );

    const total = totalResult?.count ?? 0;

    if (total === 0) {
      return { data: [], total: 0, nextOffset: null };
    }

    const rows = await this.db
      .select({ contact: contacts })
      .from(segment_contacts)
      .innerJoin(contacts, eq(segment_contacts.contact_id, contacts.id))
      .where(
        and(
          eq(segment_contacts.segment_id, segmentId),
          eq(contacts.organization_id, orgId),
        ),
      )
      .orderBy(desc(segment_contacts.added_at))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const nextOffset =
      pagination.offset + rows.length < total
        ? pagination.offset + rows.length
        : null;

    return {
      data: rows.map((row) => this.mapToEntity(row.contact)),
      total,
      nextOffset,
    };
  }

  private async fetchDynamicSegmentContacts(
    orgId: string,
    criteria: FilterCriteria | null,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: Contact[]; total: number; nextOffset: number | null }> {
    const where = criteria
      ? buildFilterWhere(criteria, orgId)
      : eq(contacts.organization_id, orgId);

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(where);

    const total = totalResult?.count ?? 0;
    if (total === 0) {
      return { data: [], total: 0, nextOffset: null };
    }

    const rows = await this.db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.created_at))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const nextOffset =
      pagination.offset + rows.length < total
        ? pagination.offset + rows.length
        : null;

    return {
      data: rows.map((row) => this.mapToEntity(row)),
      total,
      nextOffset,
    };
  }

  async save(contact: Contact): Promise<void> {
    const props = contact.toProps();
    const row = this.mapToRow(props);
    await this.db
      .insert(contacts)
      .values(row)
      .onConflictDoUpdate({
        target: contacts.id,
        set: {
          email: props.email,
          first_name: props.firstName,
          last_name: props.lastName,
          phone: props.phone,
          status: props.status,
          custom_fields: props.customFields as any,
          last_activity_at: props.lastActivityAt ?? null,
          updated_at: new Date(),
        },
      });
  }

  async saveMany(contactsList: Contact[]): Promise<void> {
    if (contactsList.length === 0) return;

    // Batch inserts could be complex with upserts depending on dialect support
    // For now simple Promise.all (not atomic but okay for MVP refactor)
    // Or use db.transaction
    await this.db.transaction(async (tx) => {
      for (const contact of contactsList) {
        const props = contact.toProps();
        const row = this.mapToRow(props);
        await tx
          .insert(contacts)
          .values(row)
          .onConflictDoUpdate({
            target: contacts.id,
            set: {
              email: props.email,
              first_name: props.firstName,
              last_name: props.lastName,
              phone: props.phone,
              status: props.status,
              custom_fields: props.customFields as any,
              last_activity_at: props.lastActivityAt ?? null,
              updated_at: new Date(),
            },
          });
      }
    });
  }

  async delete(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.organization_id, orgId)));
  }

  async countByOrganization(orgId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(eq(contacts.organization_id, orgId));
    return result?.count ?? 0;
  }

  private mapToEntity(row: typeof contacts.$inferSelect): Contact {
    return Contact.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      status: row.status as any,
      companyId: null,
      customFields: row.custom_fields as Record<string, unknown>,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapToRow(props: ContactProps): typeof contacts.$inferInsert {
    return {
      id: props.id,
      organization_id: props.organizationId,
      email: props.email ?? null,
      first_name: props.firstName ?? null,
      last_name: props.lastName ?? null,
      phone: props.phone ?? null,
      status: props.status,
      custom_fields: props.customFields as any,
      last_activity_at: props.lastActivityAt ?? null,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }
}
