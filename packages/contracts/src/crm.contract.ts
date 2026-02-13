import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  IdParamSchema,
  PaginationQuerySchema,
  PaginatedResponseSchema,
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
  },
});
