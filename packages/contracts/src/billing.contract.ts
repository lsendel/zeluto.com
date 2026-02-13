import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, PaginationQuerySchema, PaginatedResponseSchema } from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(['free', 'starter', 'pro', 'enterprise']),
  displayName: z.string(),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  stripePriceIdMonthly: z.string().nullable(),
  stripePriceIdYearly: z.string().nullable(),
  isActive: z.boolean(),
});

export const PlanLimitSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  resource: z.string(),
  limitValue: z.number(),
});

export const PlanWithLimitsSchema = PlanSchema.extend({
  limits: z.array(PlanLimitSchema),
});

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid']),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  stripeInvoiceId: z.string(),
  amount: z.number(),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
  periodStart: z.string(),
  periodEnd: z.string(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});

export const UsageRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  resource: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  currentValue: z.number(),
});

export const UsageSchema = z.object({
  resource: z.string(),
  current: z.number(),
  limit: z.number(),
  resetAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateCheckoutBodySchema = z.object({
  planId: z.string().uuid(),
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const ChangePlanBodySchema = z.object({
  planId: z.string().uuid(),
  billingPeriod: z.enum(['monthly', 'yearly']).optional(),
});

// ---------------------------------------------------------------------------
// Path-param schemas
// ---------------------------------------------------------------------------

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const ResourceParamSchema = z.object({
  resource: z.string(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const billingContract = c.router({
  plans: {
    list: {
      method: 'GET',
      path: '/api/v1/billing/plans',
      responses: {
        200: z.array(PlanSchema),
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/billing/plans/:id',
      pathParams: UuidParamSchema,
      responses: {
        200: PlanWithLimitsSchema,
        404: ErrorSchema,
      },
    },
  },
  subscription: {
    get: {
      method: 'GET',
      path: '/api/v1/billing/subscription',
      responses: {
        200: SubscriptionSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
    createCheckout: {
      method: 'POST',
      path: '/api/v1/billing/subscription/checkout',
      body: CreateCheckoutBodySchema,
      responses: {
        200: z.object({ url: z.string(), sessionId: z.string() }),
        400: ErrorSchema,
        401: ErrorSchema,
      },
    },
    cancel: {
      method: 'POST',
      path: '/api/v1/billing/subscription/cancel',
      body: z.object({}).optional(),
      responses: {
        200: SubscriptionSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
    changePlan: {
      method: 'POST',
      path: '/api/v1/billing/subscription/change-plan',
      body: ChangePlanBodySchema,
      responses: {
        200: SubscriptionSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
    createPortalSession: {
      method: 'POST',
      path: '/api/v1/billing/subscription/portal',
      body: z.object({
        returnUrl: z.string().url().optional(),
      }).optional(),
      responses: {
        200: z.object({ url: z.string() }),
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  usage: {
    getCurrent: {
      method: 'GET',
      path: '/api/v1/billing/usage',
      responses: {
        200: z.array(UsageSchema),
        401: ErrorSchema,
      },
    },
    getForResource: {
      method: 'GET',
      path: '/api/v1/billing/usage/:resource',
      pathParams: ResourceParamSchema,
      responses: {
        200: UsageSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
    getHistory: {
      method: 'GET',
      path: '/api/v1/billing/usage/history',
      query: PaginationQuerySchema.extend({
        resource: z.string().optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(UsageRecordSchema),
        401: ErrorSchema,
      },
    },
  },
  invoices: {
    list: {
      method: 'GET',
      path: '/api/v1/billing/invoices',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(InvoiceSchema),
        401: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/billing/invoices/:id',
      pathParams: UuidParamSchema,
      responses: {
        200: InvoiceSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  webhooks: {
    stripe: {
      method: 'POST',
      path: '/api/v1/billing/webhooks/stripe',
      body: z.any(),
      responses: {
        200: z.object({ received: z.boolean() }),
        400: ErrorSchema,
      },
    },
  },
});
