import type { FilterCriteria } from '@mauntic/crm-domain';
import { Company, Field, Segment, Tag } from '@mauntic/crm-domain';
import type { TenantContext } from '@mauntic/domain-kernel';
import { asCompanyId, asContactId, asSegmentId } from '@mauntic/domain-kernel';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { ContactService } from '../application/contact-service.js';
import { QueueDomainEventPublisher } from '../application/domain-event-publisher.js';
import { DrizzleCompanyRepository } from '../infrastructure/repositories/drizzle-company-repository.js';
import { DrizzleContactRepository } from '../infrastructure/repositories/drizzle-contact-repository.js';
import { DrizzleFieldRepository } from '../infrastructure/repositories/drizzle-field-repository.js';
import { DrizzleSegmentRepository } from '../infrastructure/repositories/drizzle-segment-repository.js';
import { DrizzleTagRepository } from '../infrastructure/repositories/drizzle-tag-repository.js';

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

function getSegmentRepo(ctx: CrmPlatformContext) {
  return new DrizzleSegmentRepository(ctx.db);
}

function getTagRepo(ctx: CrmPlatformContext) {
  return new DrizzleTagRepository(ctx.db);
}

function getFieldRepo(ctx: CrmPlatformContext) {
  return new DrizzleFieldRepository(ctx.db);
}

function getCompanyRepo(ctx: CrmPlatformContext) {
  return new DrizzleCompanyRepository(ctx.db);
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
    list: async ({ query }: any, ctx: CrmPlatformContext) => {
      const repo = new DrizzleContactRepository(ctx.db);
      const result = await repo.findByOrganization(ctx.tenant.organizationId, {
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

    get: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = new DrizzleContactRepository(ctx.db);
      const contact = await repo.findById(
        ctx.tenant.organizationId,
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

    activity: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = new DrizzleContactRepository(ctx.db);
      const contact = await repo.findById(
        ctx.tenant.organizationId,
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
    list: async ({ query }: any, ctx: CrmPlatformContext) => {
      const repo = getCompanyRepo(ctx);
      const result = await repo.findByOrganization(ctx.tenant.organizationId, {
        page: query.page,
        limit: query.limit,
        search: query.search,
      });

      return {
        status: 200 as const,
        body: {
          data: result.data.map((c) => c.toProps()),
          total: result.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(result.total / query.limit),
        },
      };
    },

    create: async ({ body }: any, ctx: CrmPlatformContext) => {
      const repo = getCompanyRepo(ctx);
      const company = Company.create({
        organizationId: ctx.tenant.organizationId,
        name: body.name,
        domain: body.domain ?? null,
        industry: body.industry ?? null,
        size: body.size ?? null,
      });
      await repo.save(company);
      return { status: 201 as const, body: company.toProps() };
    },

    get: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getCompanyRepo(ctx);
      const company = await repo.findById(
        ctx.tenant.organizationId,
        asCompanyId(String(params.id)),
      );
      if (!company) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Company not found' },
        };
      }
      return { status: 200 as const, body: company.toProps() };
    },

    update: async ({ params, body }: any, ctx: CrmPlatformContext) => {
      const repo = getCompanyRepo(ctx);
      const company = await repo.findById(
        ctx.tenant.organizationId,
        asCompanyId(String(params.id)),
      );

      if (!company) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Company not found' },
        };
      }

      company.update({
        name: body.name,
        domain: body.domain,
        industry: body.industry,
        size: body.size,
      });
      await repo.save(company);

      return { status: 200 as const, body: company.toProps() };
    },

    delete: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getCompanyRepo(ctx);
      const company = await repo.findById(
        ctx.tenant.organizationId,
        asCompanyId(String(params.id)),
      );
      if (!company) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Company not found' },
        };
      }

      await repo.delete(
        ctx.tenant.organizationId,
        asCompanyId(String(params.id)),
      );
      return { status: 200 as const, body: { success: true } };
    },
  },

  // -----------------------------------------------------------------------
  // Segments
  // -----------------------------------------------------------------------
  segments: {
    list: async ({ query }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const result = await repo.findByOrganization(ctx.tenant.organizationId, {
        page: query.page,
        limit: query.limit,
      });

      return {
        status: 200 as const,
        body: {
          data: result.data.map((s) => s.toProps()),
          total: result.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(result.total / query.limit),
        },
      };
    },

    create: async ({ body }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);

      let contactCount = 0;
      if (body.type === 'dynamic' && body.filters) {
        contactCount = await repo.countMatchingContacts(
          ctx.tenant.organizationId,
          body.filters as FilterCriteria,
        );
      }

      const segment = Segment.create({
        organizationId: ctx.tenant.organizationId,
        name: body.name,
        type: body.type,
        filterCriteria: body.filters ?? null,
      });
      segment.updateContactCount(contactCount);
      await repo.save(segment);

      return { status: 201 as const, body: segment.toProps() };
    },

    get: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const segment = await repo.findById(
        ctx.tenant.organizationId,
        asSegmentId(String(params.id)),
      );

      if (!segment) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Segment not found' },
        };
      }

      // For dynamic segments, recompute contact count
      if (segment.type === 'dynamic' && segment.filterCriteria) {
        const currentCount = await repo.countMatchingContacts(
          ctx.tenant.organizationId,
          segment.filterCriteria as FilterCriteria,
        );
        if (currentCount !== segment.contactCount) {
          segment.updateContactCount(currentCount);
          await repo.save(segment);
        }
      }

      return { status: 200 as const, body: segment.toProps() };
    },

    update: async ({ params, body }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const segment = await repo.findById(
        ctx.tenant.organizationId,
        asSegmentId(String(params.id)),
      );

      if (!segment) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Segment not found' },
        };
      }

      segment.update({
        name: body.name,
        filterCriteria: body.filters,
      });

      // Recompute count if dynamic segment with updated filters
      if (
        segment.type === 'dynamic' &&
        body.filters !== undefined &&
        segment.filterCriteria
      ) {
        const currentCount = await repo.countMatchingContacts(
          ctx.tenant.organizationId,
          segment.filterCriteria as FilterCriteria,
        );
        segment.updateContactCount(currentCount);
      }

      await repo.save(segment);

      return { status: 200 as const, body: segment.toProps() };
    },

    delete: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const segment = await repo.findById(
        ctx.tenant.organizationId,
        asSegmentId(String(params.id)),
      );

      if (!segment) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Segment not found' },
        };
      }

      await repo.delete(
        ctx.tenant.organizationId,
        asSegmentId(String(params.id)),
      );
      return { status: 200 as const, body: { success: true } };
    },

    addContacts: async ({ params, body }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const segmentId = asSegmentId(String(params.id));
      const segment = await repo.findById(ctx.tenant.organizationId, segmentId);

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

      const contactIds = (body.contactIds as string[]).map(asContactId);
      await repo.addContacts(ctx.tenant.organizationId, segmentId, contactIds);

      return { status: 200 as const, body: { added: contactIds.length } };
    },

    removeContacts: async ({ params, body }: any, ctx: CrmPlatformContext) => {
      const repo = getSegmentRepo(ctx);
      const segmentId = asSegmentId(String(params.id));
      const segment = await repo.findById(ctx.tenant.organizationId, segmentId);

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

      const contactIds = (body.contactIds as string[]).map(asContactId);
      await repo.removeContacts(
        ctx.tenant.organizationId,
        segmentId,
        contactIds,
      );

      return {
        status: 200 as const,
        body: { removed: contactIds.length },
      };
    },
  },

  // -----------------------------------------------------------------------
  // Tags
  // -----------------------------------------------------------------------
  tags: {
    list: async (_args: any, ctx: CrmPlatformContext) => {
      const repo = getTagRepo(ctx);
      const result = await repo.findByOrganization(ctx.tenant.organizationId, {
        page: 1,
        limit: 1000,
      });
      return {
        status: 200 as const,
        body: result.data.map((t) => t.toProps()),
      };
    },

    create: async ({ body }: any, ctx: CrmPlatformContext) => {
      const repo = getTagRepo(ctx);
      const existing = await repo.findByName(
        ctx.tenant.organizationId,
        body.name,
      );

      if (existing) {
        return {
          status: 400 as const,
          body: {
            code: 'VALIDATION_ERROR',
            message: `Tag "${body.name}" already exists`,
          },
        };
      }

      const tag = Tag.create({
        organizationId: ctx.tenant.organizationId,
        name: body.name,
        color: body.color ?? null,
      });
      await repo.save(tag);

      return { status: 201 as const, body: tag.toProps() };
    },

    delete: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getTagRepo(ctx);
      const tag = await repo.findById(
        ctx.tenant.organizationId,
        String(params.id),
      );

      if (!tag) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Tag not found' },
        };
      }

      await repo.delete(ctx.tenant.organizationId, String(params.id));
      return { status: 200 as const, body: { success: true } };
    },
  },

  // -----------------------------------------------------------------------
  // Fields
  // -----------------------------------------------------------------------
  fields: {
    list: async ({ query }: any, ctx: CrmPlatformContext) => {
      const repo = getFieldRepo(ctx);
      const results = await repo.findByOrganization(
        ctx.tenant.organizationId,
        query?.entityType,
      );
      return {
        status: 200 as const,
        body: results.map((f) => f.toProps()),
      };
    },

    create: async ({ body }: any, ctx: CrmPlatformContext) => {
      const repo = getFieldRepo(ctx);
      const existing = await repo.findByName(
        ctx.tenant.organizationId,
        body.entityType,
        body.name,
      );

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

      const field = Field.create({
        organizationId: ctx.tenant.organizationId,
        entityType: body.entityType,
        name: body.name,
        label: body.label,
        fieldType: body.fieldType,
        options: body.options ?? null,
        isRequired: body.isRequired ?? false,
        sortOrder: body.sortOrder ?? 0,
      });
      await repo.save(field);

      return { status: 201 as const, body: field.toProps() };
    },

    update: async ({ params, body }: any, ctx: CrmPlatformContext) => {
      const repo = getFieldRepo(ctx);
      const field = await repo.findById(
        ctx.tenant.organizationId,
        String(params.id),
      );

      if (!field) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Field not found' },
        };
      }

      field.update({
        label: body.label,
        options: body.options,
        isRequired: body.isRequired,
        sortOrder: body.sortOrder,
      });
      await repo.save(field);

      return { status: 200 as const, body: field.toProps() };
    },

    delete: async ({ params }: any, ctx: CrmPlatformContext) => {
      const repo = getFieldRepo(ctx);
      const field = await repo.findById(
        ctx.tenant.organizationId,
        String(params.id),
      );

      if (!field) {
        return {
          status: 404 as const,
          body: { code: 'NOT_FOUND', message: 'Field not found' },
        };
      }

      await repo.delete(ctx.tenant.organizationId, String(params.id));
      return { status: 200 as const, body: { success: true } };
    },
  },
};
