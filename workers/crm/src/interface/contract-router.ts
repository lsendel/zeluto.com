import {
  contact_tags,
  contacts,
  fields,
  segment_contacts,
  segments,
  tags,
} from '@mauntic/crm-domain/drizzle';
import type { TenantContext } from '@mauntic/domain-kernel';
import { asContactId } from '@mauntic/domain-kernel';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { ContactService } from '../application/contact-service.js';
import { QueueDomainEventPublisher } from '../application/domain-event-publisher.js';
import {
  createCompany,
  deleteCompany,
  findAllCompanies,
  findCompanyById,
  updateCompany,
} from '../infrastructure/repositories/company-repository.js';
import { DrizzleContactRepository } from '../infrastructure/repositories/drizzle-contact-repository.js';
import {
  buildFilterWhere,
  type FilterCriteria,
} from '../services/filter-engine.js';

// ---------------------------------------------------------------------------
// Platform context — passed from Hono middleware via fetchRequestHandler
// ---------------------------------------------------------------------------

export interface CrmPlatformContext {
  tenant: TenantContext;
  db: NeonHttpDatabase;
  events: Queue;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContactService(ctx: CrmPlatformContext): ContactService {
  const repo = new DrizzleContactRepository(ctx.db);
  const publisher = new QueueDomainEventPublisher(ctx.events);
  return new ContactService(repo, publisher);
}

function serializeSegment(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    name: row.name as string,
    type: row.type as 'static' | 'dynamic',
    filters: (row.filter_criteria ?? {}) as Record<string, unknown>,
    contactCount: (row.contact_count ?? 0) as number,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function serializeTag(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color ?? '') as string,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

function serializeField(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    entityType: row.entity_type as 'contact' | 'company',
    name: row.name as string,
    label: row.label as string,
    fieldType: row.field_type as
      | 'text'
      | 'number'
      | 'date'
      | 'select'
      | 'multiselect',
    options: (row.options ?? null) as string[] | null,
    isRequired: (row.is_required ?? false) as boolean,
    sortOrder: (row.sort_order ?? 0) as number,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

// @ts-rest v3.52 doesn't support Zod v4 at the type level, so `tsr.router()`
// inference breaks. We define a plain router object instead; request parsing
// and response serialization still happen correctly at runtime via Zod v4's
// backwards-compatible parse API. Full compile-time safety comes once
// @ts-rest publishes Zod v4 support.

// biome-ignore lint/suspicious/noExplicitAny: Zod v4 compat (see above)
export const crmRouter: any = {
    // -----------------------------------------------------------------------
    // Contacts
    // -----------------------------------------------------------------------
    contacts: {
      list: async ({ query }: any, { tenant, db }: CrmPlatformContext) => {
        const repo = new DrizzleContactRepository(db);
        const result = await repo.findByOrganization(tenant.organizationId, {
          page: query.page,
          limit: query.limit,
          search: query.search,
        });
        return {
          status: 200 as const,
          body: {
            data: result.data.map((c: any) => c.toProps()),
            total: result.total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(result.total / query.limit),
          },
        };
      },

      create: async ({ body }: any, ctx: CrmPlatformContext) => {
        const service = getContactService(ctx);
        const result = await service.create({
          organizationId: ctx.tenant.organizationId,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          customFields: body.customFields,
        });

        if (result.isFailure) {
          return {
            status: 400 as const,
            body: { code: 'VALIDATION_ERROR', message: result.getError() },
          };
        }

        return { status: 201 as const, body: result.getValue().toProps() };
      },

      get: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const repo = new DrizzleContactRepository(db);
        const contact = await repo.findById(
          tenant.organizationId,
          asContactId(String(params.id)),
        );

        if (!contact) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Contact not found' },
          };
        }

        return { status: 200 as const, body: contact.toProps() };
      },

      update: async ({ params, body }: any, ctx: CrmPlatformContext) => {
        const service = getContactService(ctx);
        const result = await service.update(
          ctx.tenant.organizationId,
          asContactId(String(params.id)),
          {
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone,
            customFields: body.customFields,
          },
        );

        if (result.isFailure) {
          const error = result.getError();
          if (error === 'Contact not found') {
            return {
              status: 404 as const,
              body: { code: 'NOT_FOUND', message: error },
            };
          }
          return {
            status: 400 as const,
            body: { code: 'VALIDATION_ERROR', message: error },
          };
        }

        return { status: 200 as const, body: result.getValue().toProps() };
      },

      delete: async ({ params }: any, ctx: CrmPlatformContext) => {
        const service = getContactService(ctx);
        const result = await service.delete(
          ctx.tenant.organizationId,
          asContactId(String(params.id)),
          ctx.tenant.userId,
        );

        if (result.isFailure) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: result.getError() },
          };
        }

        return { status: 200 as const, body: { success: true } };
      },

      import: async (_args: any, _ctx: CrmPlatformContext) => {
        return {
          status: 400 as const,
          body: {
            code: 'NOT_IMPLEMENTED',
            message: 'Contact import not yet implemented',
          },
        };
      },

      export: async (_args: any, _ctx: CrmPlatformContext) => {
        return {
          status: 400 as const,
          body: {
            code: 'NOT_IMPLEMENTED',
            message: 'Contact export not yet implemented',
          },
        };
      },

      merge: async (_args: any, _ctx: CrmPlatformContext) => {
        return {
          status: 400 as const,
          body: {
            code: 'NOT_IMPLEMENTED',
            message: 'Contact merge not yet implemented',
          },
        };
      },

      activity: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        // Stub: return empty paginated result
        const repo = new DrizzleContactRepository(db);
        const contact = await repo.findById(
          tenant.organizationId,
          asContactId(String(params.id)),
        );

        if (!contact) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Contact not found' },
          };
        }

        return {
          status: 200 as const,
          body: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      },
    },

    // -----------------------------------------------------------------------
    // Companies
    // -----------------------------------------------------------------------
    companies: {
      list: async ({ query }: any, { tenant, db }: CrmPlatformContext) => {
        const result = await findAllCompanies(db, tenant.organizationId, {
          page: query.page,
          limit: query.limit,
          search: query.search,
        });

        return {
          status: 200 as const,
          body: {
            data: result.data,
            total: result.total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(result.total / query.limit),
          },
        };
      },

      create: async ({ body }: any, { tenant, db }: CrmPlatformContext) => {
        const company = await createCompany(db, tenant.organizationId, {
          name: body.name,
          domain: body.domain ?? null,
          industry: body.industry ?? null,
          size: body.size ?? null,
          custom_fields: null,
        });

        return { status: 201 as const, body: company };
      },

      get: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const company = await findCompanyById(
          db,
          tenant.organizationId,
          String(params.id),
        );
        if (!company) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Company not found' },
          };
        }
        return { status: 200 as const, body: company };
      },

      update: async ({ params, body }: any, { tenant, db }: CrmPlatformContext) => {
        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.domain !== undefined) updateData.domain = body.domain;
        if (body.industry !== undefined) updateData.industry = body.industry;
        if (body.size !== undefined) updateData.size = body.size;

        const company = await updateCompany(
          db,
          tenant.organizationId,
          String(params.id),
          updateData,
        );

        if (!company) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Company not found' },
          };
        }

        return { status: 200 as const, body: company };
      },

      delete: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const deleted = await deleteCompany(
          db,
          tenant.organizationId,
          String(params.id),
        );
        if (!deleted) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Company not found' },
          };
        }
        return { status: 200 as const, body: { success: true } };
      },
    },

    // -----------------------------------------------------------------------
    // Segments
    // -----------------------------------------------------------------------
    segments: {
      list: async ({ query }: any, { tenant, db }: CrmPlatformContext) => {
        const offset = (query.page - 1) * query.limit;

        const [rows, totalResult] = await Promise.all([
          db
            .select()
            .from(segments)
            .where(eq(segments.organization_id, tenant.organizationId))
            .orderBy(desc(segments.created_at))
            .limit(query.limit)
            .offset(offset),
          db
            .select({ total: count() })
            .from(segments)
            .where(eq(segments.organization_id, tenant.organizationId)),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
          status: 200 as const,
          body: {
            data: rows.map(serializeSegment),
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },

      create: async ({ body }: any, { tenant, db }: CrmPlatformContext) => {
        let contactCount = 0;
        if (body.type === 'dynamic' && body.filters) {
          const criteria = body.filters as unknown as FilterCriteria;
          const where = buildFilterWhere(criteria, tenant.organizationId);
          const result = await db
            .select({ total: count() })
            .from(contacts)
            .where(where);
          contactCount = result[0]?.total ?? 0;
        }

        const [created] = await db
          .insert(segments)
          .values({
            organization_id: tenant.organizationId,
            name: body.name,
            type: body.type,
            filter_criteria: body.filters ?? null,
            contact_count: contactCount,
          })
          .returning();

        return { status: 201 as const, body: serializeSegment(created) };
      },

      get: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const segmentId = String(params.id);

        const [segment] = await db
          .select()
          .from(segments)
          .where(
            and(
              eq(segments.id, segmentId),
              eq(segments.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!segment) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Segment not found' },
          };
        }

        // For dynamic segments, recompute contact count
        if (segment.type === 'dynamic' && segment.filter_criteria) {
          const criteria = segment.filter_criteria as unknown as FilterCriteria;
          const where = buildFilterWhere(criteria, tenant.organizationId);
          const result = await db
            .select({ total: count() })
            .from(contacts)
            .where(where);
          const currentCount = result[0]?.total ?? 0;

          if (currentCount !== segment.contact_count) {
            await db
              .update(segments)
              .set({ contact_count: currentCount, updated_at: new Date() })
              .where(eq(segments.id, segmentId));
            segment.contact_count = currentCount;
          }
        }

        return { status: 200 as const, body: serializeSegment(segment) };
      },

      update: async ({ params, body }: any, { tenant, db }: CrmPlatformContext) => {
        const segmentId = String(params.id);

        const [existing] = await db
          .select()
          .from(segments)
          .where(
            and(
              eq(segments.id, segmentId),
              eq(segments.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Segment not found' },
          };
        }

        const updates: Record<string, unknown> = { updated_at: new Date() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.filters !== undefined) {
          updates.filter_criteria = body.filters;

          if (existing.type === 'dynamic') {
            const criteria = body.filters as unknown as FilterCriteria;
            const where = buildFilterWhere(criteria, tenant.organizationId);
            const result = await db
              .select({ total: count() })
              .from(contacts)
              .where(where);
            updates.contact_count = result[0]?.total ?? 0;
          }
        }

        const [updated] = await db
          .update(segments)
          .set(updates)
          .where(eq(segments.id, segmentId))
          .returning();

        return { status: 200 as const, body: serializeSegment(updated) };
      },

      delete: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const segmentId = String(params.id);

        const [existing] = await db
          .select({ id: segments.id })
          .from(segments)
          .where(
            and(
              eq(segments.id, segmentId),
              eq(segments.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Segment not found' },
          };
        }

        await db
          .delete(segment_contacts)
          .where(eq(segment_contacts.segment_id, segmentId));
        await db.delete(segments).where(eq(segments.id, segmentId));

        return { status: 200 as const, body: { success: true } };
      },

      addContacts: async ({ params, body }: any, { tenant, db }: CrmPlatformContext) => {
        const segmentId = String(params.id);

        const [segment] = await db
          .select()
          .from(segments)
          .where(
            and(
              eq(segments.id, segmentId),
              eq(segments.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!segment) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Segment not found' },
          };
        }

        if (segment.type !== 'static') {
          return {
            status: 400 as const,
            body: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot manually add contacts to a dynamic segment',
            },
          };
        }

        const contactIds: string[] = (body.contactIds as number[]).map(String);

        const validContacts = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              inArray(contacts.id, contactIds),
              eq(contacts.organization_id, tenant.organizationId),
            ),
          );

        const validIds = new Set(validContacts.map((c) => c.id));

        const existingLinks = await db
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
          await db.insert(segment_contacts).values(
            toInsert.map((contactId) => ({
              segment_id: segmentId,
              contact_id: contactId,
            })),
          );

          await db
            .update(segments)
            .set({
              contact_count: (segment.contact_count ?? 0) + toInsert.length,
              updated_at: new Date(),
            })
            .where(eq(segments.id, segmentId));
        }

        return { status: 200 as const, body: { added: toInsert.length } };
      },

      removeContacts: async ({ params, body }: any, { tenant, db }: CrmPlatformContext) => {
        const segmentId = String(params.id);

        const [segment] = await db
          .select()
          .from(segments)
          .where(
            and(
              eq(segments.id, segmentId),
              eq(segments.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!segment) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Segment not found' },
          };
        }

        if (segment.type !== 'static') {
          return {
            status: 400 as const,
            body: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot manually remove contacts from a dynamic segment',
            },
          };
        }

        const contactIds: string[] = (body.contactIds as number[]).map(String);

        const result = await db
          .delete(segment_contacts)
          .where(
            and(
              eq(segment_contacts.segment_id, segmentId),
              inArray(segment_contacts.contact_id, contactIds),
            ),
          )
          .returning({ id: segment_contacts.id });

        const removed = result.length;

        if (removed > 0) {
          await db
            .update(segments)
            .set({
              contact_count: Math.max(
                (segment.contact_count ?? 0) - removed,
                0,
              ),
              updated_at: new Date(),
            })
            .where(eq(segments.id, segmentId));
        }

        return { status: 200 as const, body: { removed } };
      },
    },

    // -----------------------------------------------------------------------
    // Tags
    // -----------------------------------------------------------------------
    tags: {
      list: async (_args: any, { tenant, db }: CrmPlatformContext) => {
        const rows = await db
          .select()
          .from(tags)
          .where(eq(tags.organization_id, tenant.organizationId))
          .orderBy(tags.name);

        return { status: 200 as const, body: rows.map(serializeTag) };
      },

      create: async ({ body }: any, { tenant, db }: CrmPlatformContext) => {
        const [existing] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.organization_id, tenant.organizationId),
              eq(tags.name, body.name),
            ),
          )
          .limit(1);

        if (existing) {
          return {
            status: 400 as const,
            body: {
              code: 'VALIDATION_ERROR',
              message: `Tag "${body.name}" already exists`,
            },
          };
        }

        const [created] = await db
          .insert(tags)
          .values({
            organization_id: tenant.organizationId,
            name: body.name,
            color: body.color ?? null,
          })
          .returning();

        return { status: 201 as const, body: serializeTag(created) };
      },

      delete: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const tagId = params.id;

        const [existing] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.id, tagId),
              eq(tags.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Tag not found' },
          };
        }

        await db.delete(contact_tags).where(eq(contact_tags.tag_id, tagId));
        await db.delete(tags).where(eq(tags.id, tagId));

        return { status: 200 as const, body: { success: true } };
      },
    },

    // -----------------------------------------------------------------------
    // Fields
    // -----------------------------------------------------------------------
    fields: {
      list: async ({ query }: any, { tenant, db }: CrmPlatformContext) => {
        const conditions = [eq(fields.organization_id, tenant.organizationId)];
        if (query?.entityType) {
          conditions.push(eq(fields.entity_type, query.entityType));
        }

        const rows = await db
          .select()
          .from(fields)
          .where(and(...conditions))
          .orderBy(fields.sort_order);

        return { status: 200 as const, body: rows.map(serializeField) };
      },

      create: async ({ body }: any, { tenant, db }: CrmPlatformContext) => {
        const [existing] = await db
          .select({ id: fields.id })
          .from(fields)
          .where(
            and(
              eq(fields.organization_id, tenant.organizationId),
              eq(fields.entity_type, body.entityType),
              eq(fields.name, body.name),
            ),
          )
          .limit(1);

        if (existing) {
          return {
            status: 400 as const,
            body: {
              code: 'VALIDATION_ERROR',
              message: `Field "${body.name}" already exists for ${body.entityType}`,
            },
          };
        }

        if (
          (body.fieldType === 'select' || body.fieldType === 'multiselect') &&
          (!body.options || body.options.length === 0)
        ) {
          return {
            status: 400 as const,
            body: {
              code: 'VALIDATION_ERROR',
              message: 'options are required for select/multiselect fields',
            },
          };
        }

        const [created] = await db
          .insert(fields)
          .values({
            organization_id: tenant.organizationId,
            entity_type: body.entityType,
            name: body.name,
            label: body.label,
            field_type: body.fieldType,
            options: body.options ?? null,
            is_required: body.isRequired ?? false,
            sort_order: body.sortOrder ?? 0,
          })
          .returning();

        return { status: 201 as const, body: serializeField(created) };
      },

      update: async ({ params, body }: any, { tenant, db }: CrmPlatformContext) => {
        const fieldId = params.id;

        const [existing] = await db
          .select()
          .from(fields)
          .where(
            and(
              eq(fields.id, fieldId),
              eq(fields.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Field not found' },
          };
        }

        const updates: Record<string, unknown> = {};
        if (body.label !== undefined) updates.label = body.label;
        if (body.options !== undefined) updates.options = body.options;
        if (body.isRequired !== undefined)
          updates.is_required = body.isRequired;
        if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;

        if (Object.keys(updates).length === 0) {
          return { status: 200 as const, body: serializeField(existing) };
        }

        const [updated] = await db
          .update(fields)
          .set(updates)
          .where(eq(fields.id, fieldId))
          .returning();

        return { status: 200 as const, body: serializeField(updated) };
      },

      delete: async ({ params }: any, { tenant, db }: CrmPlatformContext) => {
        const fieldId = params.id;

        const [existing] = await db
          .select({ id: fields.id })
          .from(fields)
          .where(
            and(
              eq(fields.id, fieldId),
              eq(fields.organization_id, tenant.organizationId),
            ),
          )
          .limit(1);

        if (!existing) {
          return {
            status: 404 as const,
            body: { code: 'NOT_FOUND', message: 'Field not found' },
          };
        }

        await db.delete(fields).where(eq(fields.id, fieldId));

        return { status: 200 as const, body: { success: true } };
      },
    },
  };
