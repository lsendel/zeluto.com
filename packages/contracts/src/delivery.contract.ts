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
  id: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  recipientCount: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string(),
});

export const DeliveryEventSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  contactId: z.number(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  eventType: z.enum(['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed']),
  providerMessageId: z.string().nullable(),
  createdAt: z.string(),
});

export const ProviderConfigSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  providerType: z.string(),
  isActive: z.boolean(),
  priority: z.number(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const SuppressionSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  reason: z.enum(['bounce', 'complaint', 'unsubscribe', 'manual']),
  createdAt: z.string(),
});

export const SendingDomainSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  status: z.enum(['pending', 'verified', 'failed']),
  dnsRecords: z.array(z.object({
    type: z.string(),
    name: z.string(),
    value: z.string(),
    verified: z.boolean(),
  })),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const WarmupScheduleSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  dailyLimit: z.number(),
  currentDay: z.number(),
  startedAt: z.string(),
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

const SendBatchBodySchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  messages: z.array(z.object({
    to: z.string(),
    subject: z.string().optional(),
    body: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
  providerId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
});

const CreateProviderConfigBodySchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
  providerType: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  config: z.record(z.string(), z.unknown()),
});

const UpdateProviderConfigBodySchema = z.object({
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const AddSuppressionBodySchema = z.object({
  email: z.string().email(),
  reason: z.enum(['bounce', 'complaint', 'unsubscribe', 'manual']),
});

const AddSendingDomainBodySchema = z.object({
  domain: z.string().min(1),
});

const CreateWarmupScheduleBodySchema = z.object({
  domain: z.string().min(1),
  dailyLimit: z.number().positive(),
});

const UpdateWarmupScheduleBodySchema = z.object({
  dailyLimit: z.number().positive(),
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
  sendBatch: {
    method: 'POST',
    path: '/api/v1/delivery/send/batch',
    body: SendBatchBodySchema,
    responses: {
      201: DeliveryJobSchema,
      400: ErrorSchema,
    },
  },
  jobs: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/jobs',
      query: PaginationQuerySchema.extend({
        channel: z.enum(['email', 'sms', 'push', 'webhook']).optional(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(DeliveryJobSchema),
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/delivery/jobs/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: DeliveryJobSchema,
        404: ErrorSchema,
      },
    },
    getEvents: {
      method: 'GET',
      path: '/api/v1/delivery/jobs/:id/events',
      pathParams: z.object({ id: z.string().uuid() }),
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(DeliveryEventSchema),
        404: ErrorSchema,
      },
    },
  },
  tracking: {
    webhook: {
      method: 'POST',
      path: '/api/v1/delivery/tracking/:provider',
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
        200: z.array(ProviderConfigSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/delivery/providers',
      body: CreateProviderConfigBodySchema,
      responses: {
        201: ProviderConfigSchema,
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/delivery/providers/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateProviderConfigBodySchema,
      responses: {
        200: ProviderConfigSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/delivery/providers/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    test: {
      method: 'POST',
      path: '/api/v1/delivery/providers/:id/test',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({
        to: z.string(),
        subject: z.string().optional(),
        body: z.string(),
      }),
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          providerResponse: z.record(z.string(), z.unknown()).optional(),
        }),
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  suppressions: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/suppressions',
      query: PaginationQuerySchema.extend({
        reason: z.enum(['bounce', 'complaint', 'unsubscribe', 'manual']).optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(SuppressionSchema),
      },
    },
    add: {
      method: 'POST',
      path: '/api/v1/delivery/suppressions',
      body: AddSuppressionBodySchema,
      responses: {
        201: SuppressionSchema,
        400: ErrorSchema,
      },
    },
    remove: {
      method: 'DELETE',
      path: '/api/v1/delivery/suppressions/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    check: {
      method: 'GET',
      path: '/api/v1/delivery/suppressions/check',
      query: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({
          suppressed: z.boolean(),
          reason: z.enum(['bounce', 'complaint', 'unsubscribe', 'manual']).nullable(),
        }),
      },
    },
  },
  sendingDomains: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/sending-domains',
      responses: {
        200: z.array(SendingDomainSchema),
      },
    },
    add: {
      method: 'POST',
      path: '/api/v1/delivery/sending-domains',
      body: AddSendingDomainBodySchema,
      responses: {
        201: SendingDomainSchema,
        400: ErrorSchema,
      },
    },
    verify: {
      method: 'POST',
      path: '/api/v1/delivery/sending-domains/:id/verify',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: SendingDomainSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/delivery/sending-domains/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    getDnsRecords: {
      method: 'GET',
      path: '/api/v1/delivery/sending-domains/:id/dns-records',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: z.object({
          records: z.array(z.object({
            type: z.string(),
            name: z.string(),
            value: z.string(),
            verified: z.boolean(),
          })),
        }),
        404: ErrorSchema,
      },
    },
  },
  warmup: {
    list: {
      method: 'GET',
      path: '/api/v1/delivery/warmup',
      responses: {
        200: z.array(WarmupScheduleSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/delivery/warmup',
      body: CreateWarmupScheduleBodySchema,
      responses: {
        201: WarmupScheduleSchema,
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/delivery/warmup/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateWarmupScheduleBodySchema,
      responses: {
        200: WarmupScheduleSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    getProgress: {
      method: 'GET',
      path: '/api/v1/delivery/warmup/:id/progress',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: z.object({
          schedule: WarmupScheduleSchema,
          currentDayLimit: z.number(),
          sentToday: z.number(),
          remainingToday: z.number(),
          progressPercentage: z.number(),
        }),
        404: ErrorSchema,
      },
    },
  },
});
