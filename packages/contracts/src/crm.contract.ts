import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  IdParamSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ContactSchema = z.object({
  id: z.number(),
  email: z.string().email().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  companyId: z.number().nullable(),
  tags: z.array(z.string()),
  customFields: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  size: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SegmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['static', 'dynamic']),
  filters: z.record(z.string(), z.unknown()),
  contactCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
});

export const FieldSchema = z.object({
  id: z.string().uuid(),
  entityType: z.enum(['contact', 'company']),
  name: z.string(),
  label: z.string(),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multiselect']),
  options: z.array(z.string()).nullable(),
  isRequired: z.boolean(),
  sortOrder: z.number(),
});

export const ContactActivitySchema = z.object({
  id: z.string().uuid(),
  contactId: z.number(),
  eventType: z.string(),
  eventSource: z.string(),
  eventData: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateContactBodySchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  companyId: z.number().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const UpdateContactBodySchema = CreateContactBodySchema.partial();

const CreateCompanyBodySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
});

const UpdateCompanyBodySchema = CreateCompanyBodySchema.partial();

const CreateSegmentBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['static', 'dynamic']),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const UpdateSegmentBodySchema = z.object({
  name: z.string().min(1).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const CreateTagBodySchema = z.object({
  name: z.string().min(1),
  color: z.string(),
});

const CreateFieldBodySchema = z.object({
  entityType: z.enum(['contact', 'company']),
  name: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.enum(['text', 'number', 'date', 'select', 'multiselect']),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const UpdateFieldBodySchema = z.object({
  label: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const ImportContactsBodySchema = z.object({
  contacts: z.array(CreateContactBodySchema),
});

const MergeContactsBodySchema = z.object({
  primaryContactId: z.number(),
  secondaryContactId: z.number(),
});

const SegmentContactsBodySchema = z.object({
  contactIds: z.array(z.number()),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const crmContract = c.router({
  contacts: {
    list: {
      method: 'GET',
      path: '/api/v1/crm/contacts',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(ContactSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/crm/contacts',
      body: CreateContactBodySchema,
      responses: {
        201: ContactSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/crm/contacts/:id',
      pathParams: IdParamSchema,
      responses: {
        200: ContactSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/crm/contacts/:id',
      pathParams: IdParamSchema,
      body: UpdateContactBodySchema,
      responses: {
        200: ContactSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/crm/contacts/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    import: {
      method: 'POST',
      path: '/api/v1/crm/contacts/import',
      body: ImportContactsBodySchema,
      responses: {
        201: z.object({
          imported: z.number(),
          failed: z.number(),
          errors: z
            .array(
              z.object({
                index: z.number(),
                error: z.string(),
              }),
            )
            .optional(),
        }),
        400: ErrorSchema,
      },
    },
    export: {
      method: 'GET',
      path: '/api/v1/crm/contacts/export',
      query: z.object({
        format: z.enum(['csv', 'json']).default('csv'),
        segmentId: z.coerce.number().optional(),
      }),
      responses: {
        200: z.object({
          url: z.string(),
        }),
        400: ErrorSchema,
      },
    },
    merge: {
      method: 'POST',
      path: '/api/v1/crm/contacts/merge',
      body: MergeContactsBodySchema,
      responses: {
        200: ContactSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    activity: {
      method: 'GET',
      path: '/api/v1/crm/contacts/:id/activity',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(ContactActivitySchema),
        404: ErrorSchema,
      },
    },
  },
  companies: {
    list: {
      method: 'GET',
      path: '/api/v1/crm/companies',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(CompanySchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/crm/companies',
      body: CreateCompanyBodySchema,
      responses: {
        201: CompanySchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/crm/companies/:id',
      pathParams: IdParamSchema,
      responses: {
        200: CompanySchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/crm/companies/:id',
      pathParams: IdParamSchema,
      body: UpdateCompanyBodySchema,
      responses: {
        200: CompanySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/crm/companies/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
  segments: {
    list: {
      method: 'GET',
      path: '/api/v1/crm/segments',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(SegmentSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/crm/segments',
      body: CreateSegmentBodySchema,
      responses: {
        201: SegmentSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/crm/segments/:id',
      pathParams: IdParamSchema,
      responses: {
        200: SegmentSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/crm/segments/:id',
      pathParams: IdParamSchema,
      body: UpdateSegmentBodySchema,
      responses: {
        200: SegmentSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/crm/segments/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    addContacts: {
      method: 'POST',
      path: '/api/v1/crm/segments/:id/contacts',
      pathParams: IdParamSchema,
      body: SegmentContactsBodySchema,
      responses: {
        200: z.object({ added: z.number() }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    removeContacts: {
      method: 'DELETE',
      path: '/api/v1/crm/segments/:id/contacts',
      pathParams: IdParamSchema,
      body: SegmentContactsBodySchema,
      responses: {
        200: z.object({ removed: z.number() }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  tags: {
    list: {
      method: 'GET',
      path: '/api/v1/crm/tags',
      responses: {
        200: z.array(TagSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/crm/tags',
      body: CreateTagBodySchema,
      responses: {
        201: TagSchema,
        400: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/crm/tags/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
  fields: {
    list: {
      method: 'GET',
      path: '/api/v1/crm/fields',
      query: z.object({
        entityType: z.enum(['contact', 'company']).optional(),
      }),
      responses: {
        200: z.array(FieldSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/crm/fields',
      body: CreateFieldBodySchema,
      responses: {
        201: FieldSchema,
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/crm/fields/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateFieldBodySchema,
      responses: {
        200: FieldSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/crm/fields/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
});
