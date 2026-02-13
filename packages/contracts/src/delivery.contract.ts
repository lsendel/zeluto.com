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

export const DeliveryMessageSchema = z.object({
  id: z.string(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  to: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  status: z.enum(['queued', 'sent', 'delivered', 'bounced', 'failed']),
  providerId: z.number().nullable(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});

export const DeliveryJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  totalMessages: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const ProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['email', 'sms', 'push', 'webhook']),
  provider: z.string(),
  isDefault: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const TrackingEventSchema = z.object({
  messageId: z.string(),
  event: z.enum(['delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const SendMessageBodySchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  to: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  providerId: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const CreateProviderBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'sms', 'push', 'webhook']),
  provider: z.string().min(1),
  isDefault: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()),
});

const UpdateProviderBodySchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Path-param schemas
// ---------------------------------------------------------------------------

const ProviderParamSchema = z.object({
  provider: z.string(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const deliveryContract = c.router({
  send: {
    method: 'POST',
    path: '/api/v1/delivery/send',
    body: SendMessageBodySchema,
    responses: {
      201: DeliveryMessageSchema,
      400: ErrorSchema,
    },
  },
  jobs: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/jobs',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(DeliveryJobSchema),
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/delivery/jobs/:id',
      pathParams: z.object({ id: z.string() }),
      responses: {
        200: DeliveryJobSchema,
        404: ErrorSchema,
      },
    },
  },
  tracking: {
    webhook: {
      method: 'POST',
      path: '/api/v1/delivery/tracking/webhook/:provider',
      pathParams: ProviderParamSchema,
      body: z.any(),
      responses: {
        200: z.object({ received: z.boolean() }),
      },
    },
  },
  providers: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/providers',
      responses: {
        200: z.array(ProviderSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/delivery/providers',
      body: CreateProviderBodySchema,
      responses: {
        201: ProviderSchema,
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/delivery/providers/:id',
      pathParams: IdParamSchema,
      body: UpdateProviderBodySchema,
      responses: {
        200: ProviderSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
