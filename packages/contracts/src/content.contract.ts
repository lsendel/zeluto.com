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

export const TemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['email', 'sms', 'push', 'page']),
  category: z.string().nullable(),
  subject: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyJson: z.record(z.string(), z.unknown()).nullable(),
  thumbnailUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TemplateVersionSchema = z.object({
  id: z.number(),
  templateId: z.number(),
  versionNumber: z.number(),
  subject: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyJson: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export const FormSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  fields: z.array(z.record(z.string(), z.unknown())),
  settings: z.record(z.string(), z.unknown()),
  redirectUrl: z.string().nullable(),
  isActive: z.boolean(),
  submissionCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FormSubmissionSchema = z.object({
  id: z.number(),
  formId: z.number(),
  contactId: z.number().nullable(),
  data: z.record(z.string(), z.unknown()),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});

export const LandingPageSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  templateId: z.number().nullable(),
  isPublished: z.boolean(),
  publishedAt: z.string().nullable(),
  visitCount: z.number(),
  conversionCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AssetSchema = z.object({
  id: z.number(),
  name: z.string(),
  fileKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  folder: z.string().nullable(),
  createdBy: z.number(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateTemplateBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'sms', 'push', 'page']),
  category: z.string().optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  bodyJson: z.record(z.string(), z.unknown()).optional(),
  thumbnailUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpdateTemplateBodySchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  bodyHtml: z.string().nullable().optional(),
  bodyText: z.string().nullable().optional(),
  bodyJson: z.record(z.string(), z.unknown()).nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const PreviewTemplateBodySchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
});

const CreateFormBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(z.record(z.string(), z.unknown())),
  settings: z.record(z.string(), z.unknown()).optional(),
  redirectUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpdateFormBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  fields: z.array(z.record(z.string(), z.unknown())).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  redirectUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const SubmitFormBodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

const CreateLandingPageBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  templateId: z.number().optional(),
});

const UpdateLandingPageBodySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  templateId: z.number().nullable().optional(),
});

const _UploadAssetBodySchema = z.object({
  name: z.string().min(1),
  folder: z.string().optional(),
});

const SlugParamSchema = z.object({
  slug: z.string(),
});

const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const contentContract = c.router({
  templates: {
    list: {
      method: 'GET',
      path: '/api/v1/content/templates',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(TemplateSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/content/templates',
      body: CreateTemplateBodySchema,
      responses: {
        201: TemplateSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/content/templates/:id',
      pathParams: IdParamSchema,
      responses: {
        200: TemplateSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/content/templates/:id',
      pathParams: IdParamSchema,
      body: UpdateTemplateBodySchema,
      responses: {
        200: TemplateSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/content/templates/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    duplicate: {
      method: 'POST',
      path: '/api/v1/content/templates/:id/duplicate',
      pathParams: IdParamSchema,
      body: z
        .object({
          name: z.string().min(1).optional(),
        })
        .optional(),
      responses: {
        201: TemplateSchema,
        404: ErrorSchema,
      },
    },
    preview: {
      method: 'POST',
      path: '/api/v1/content/templates/:id/preview',
      pathParams: IdParamSchema,
      body: PreviewTemplateBodySchema.optional(),
      responses: {
        200: z.object({
          html: z.string(),
          text: z.string().optional(),
        }),
        404: ErrorSchema,
      },
    },
    versions: {
      method: 'GET',
      path: '/api/v1/content/templates/:id/versions',
      pathParams: IdParamSchema,
      responses: {
        200: z.array(TemplateVersionSchema),
        404: ErrorSchema,
      },
    },
  },
  forms: {
    list: {
      method: 'GET',
      path: '/api/v1/content/forms',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(FormSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/content/forms',
      body: CreateFormBodySchema,
      responses: {
        201: FormSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/content/forms/:id',
      pathParams: IdParamSchema,
      responses: {
        200: FormSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/content/forms/:id',
      pathParams: IdParamSchema,
      body: UpdateFormBodySchema,
      responses: {
        200: FormSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/content/forms/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    submit: {
      method: 'POST',
      path: '/api/v1/content/forms/:id/submit',
      pathParams: IdParamSchema,
      body: SubmitFormBodySchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          redirectUrl: z.string().optional(),
        }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  formSubmissions: {
    list: {
      method: 'GET',
      path: '/api/v1/content/forms/:id/submissions',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(FormSubmissionSchema),
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/content/submissions/:id',
      pathParams: IdParamSchema,
      responses: {
        200: FormSubmissionSchema,
        404: ErrorSchema,
      },
    },
    export: {
      method: 'GET',
      path: '/api/v1/content/forms/:id/submissions/export',
      pathParams: IdParamSchema,
      query: ExportQuerySchema,
      responses: {
        200: z.object({
          url: z.string(),
        }),
        404: ErrorSchema,
      },
    },
  },
  landingPages: {
    list: {
      method: 'GET',
      path: '/api/v1/content/landing-pages',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(LandingPageSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/content/landing-pages',
      body: CreateLandingPageBodySchema,
      responses: {
        201: LandingPageSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/content/landing-pages/:id',
      pathParams: IdParamSchema,
      responses: {
        200: LandingPageSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/content/landing-pages/:id',
      pathParams: IdParamSchema,
      body: UpdateLandingPageBodySchema,
      responses: {
        200: LandingPageSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/content/landing-pages/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    publish: {
      method: 'POST',
      path: '/api/v1/content/landing-pages/:id/publish',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: LandingPageSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    unpublish: {
      method: 'POST',
      path: '/api/v1/content/landing-pages/:id/unpublish',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: LandingPageSchema,
        404: ErrorSchema,
      },
    },
    getBySlug: {
      method: 'GET',
      path: '/p/:slug',
      pathParams: SlugParamSchema,
      responses: {
        200: z.object({
          html: z.string(),
          metadata: z.record(z.string(), z.unknown()),
        }),
        404: ErrorSchema,
      },
    },
  },
  assets: {
    list: {
      method: 'GET',
      path: '/api/v1/content/assets',
      query: PaginationQuerySchema.extend({
        folder: z.string().optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(AssetSchema),
      },
    },
    upload: {
      method: 'POST',
      path: '/api/v1/content/assets/upload',
      body: z.any(), // multipart form data
      responses: {
        201: AssetSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/content/assets/:id',
      pathParams: IdParamSchema,
      responses: {
        200: AssetSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/content/assets/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    listFolders: {
      method: 'GET',
      path: '/api/v1/content/assets/folders',
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            assetCount: z.number(),
          }),
        ),
      },
    },
  },
});
