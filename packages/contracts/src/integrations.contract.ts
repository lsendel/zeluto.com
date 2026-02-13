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

export const ConnectionSchema = z.object({
  id: z.number(),
  provider: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'error']),
  config: z.record(z.string(), z.unknown()),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SyncJobSchema = z.object({
  id: z.number(),
  connectionId: z.number(),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']),
  entityType: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  recordsProcessed: z.number(),
  recordsFailed: z.number(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const WebhookSchema = z.object({
  id: z.number(),
  url: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  secret: z.string().nullable(),
  lastTriggeredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WebhookDeliverySchema = z.object({
  id: z.number(),
  webhookId: z.number(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  responseStatus: z.number().nullable(),
  responseBody: z.string().nullable(),
  attemptCount: z.number(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateConnectionBodySchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

const UpdateConnectionBodySchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'error']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const TestConnectionBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
});

const SyncConnectionBodySchema = z.object({
  entityType: z.string().optional(),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).optional(),
});

const CreateWebhookBodySchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
  isActive: z.boolean().optional(),
  secret: z.string().optional(),
});

const UpdateWebhookBodySchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  secret: z.string().nullable().optional(),
});

const TestWebhookBodySchema = z.object({
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const integrationsContract = c.router({
  connections: {
    list: {
      method: 'GET',
      path: '/api/v1/integrations/connections',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(ConnectionSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/integrations/connections',
      body: CreateConnectionBodySchema,
      responses: {
        201: ConnectionSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/integrations/connections/:id',
      pathParams: IdParamSchema,
      responses: {
        200: ConnectionSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/integrations/connections/:id',
      pathParams: IdParamSchema,
      body: UpdateConnectionBodySchema,
      responses: {
        200: ConnectionSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/integrations/connections/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    test: {
      method: 'POST',
      path: '/api/v1/integrations/connections/:id/test',
      pathParams: IdParamSchema,
      body: TestConnectionBodySchema.optional(),
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string().optional(),
        }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    sync: {
      method: 'POST',
      path: '/api/v1/integrations/connections/:id/sync',
      pathParams: IdParamSchema,
      body: SyncConnectionBodySchema.optional(),
      responses: {
        202: SyncJobSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  syncJobs: {
    list: {
      method: 'GET',
      path: '/api/v1/integrations/connections/:id/sync-jobs',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(SyncJobSchema),
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/integrations/sync-jobs/:id',
      pathParams: IdParamSchema,
      responses: {
        200: SyncJobSchema,
        404: ErrorSchema,
      },
    },
  },
  webhooks: {
    list: {
      method: 'GET',
      path: '/api/v1/integrations/webhooks',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(WebhookSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/integrations/webhooks',
      body: CreateWebhookBodySchema,
      responses: {
        201: WebhookSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/integrations/webhooks/:id',
      pathParams: IdParamSchema,
      responses: {
        200: WebhookSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/integrations/webhooks/:id',
      pathParams: IdParamSchema,
      body: UpdateWebhookBodySchema,
      responses: {
        200: WebhookSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/integrations/webhooks/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    test: {
      method: 'POST',
      path: '/api/v1/integrations/webhooks/:id/test',
      pathParams: IdParamSchema,
      body: TestWebhookBodySchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          deliveryId: z.number().optional(),
        }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  webhookDeliveries: {
    list: {
      method: 'GET',
      path: '/api/v1/integrations/webhooks/:id/deliveries',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(WebhookDeliverySchema),
        404: ErrorSchema,
      },
    },
    retry: {
      method: 'POST',
      path: '/api/v1/integrations/deliveries/:id/retry',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: WebhookDeliverySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
