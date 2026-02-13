import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema } from './common';

const c = initContract();

export const PlanSchema = z.object({
  id: z.number(),
  name: z.enum(['free', 'starter', 'pro', 'enterprise']),
  displayName: z.string(),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  limits: z.record(z.string(), z.number()),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  organizationId: z.number(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing']),
  currentPeriodEnd: z.string(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
});

export const UsageSchema = z.object({
  resource: z.string(),
  current: z.number(),
  limit: z.number(),
  resetAt: z.string().nullable(),
});

export const billingContract = c.router({
  plans: {
    list: {
      method: 'GET',
      path: '/api/v1/billing/plans',
      responses: { 200: z.array(PlanSchema) },
    },
  },
  subscription: {
    get: {
      method: 'GET',
      path: '/api/v1/billing/subscription',
      responses: { 200: SubscriptionSchema },
    },
    create: {
      method: 'POST',
      path: '/api/v1/billing/subscription',
      body: z.object({ plan: z.enum(['starter', 'pro', 'enterprise']), paymentMethodId: z.string().optional() }),
      responses: { 201: SubscriptionSchema, 400: ErrorSchema },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/billing/subscription',
      body: z.object({ plan: z.enum(['free', 'starter', 'pro', 'enterprise']) }),
      responses: { 200: SubscriptionSchema, 400: ErrorSchema },
    },
    cancel: {
      method: 'DELETE',
      path: '/api/v1/billing/subscription',
      body: z.any().optional(),
      responses: { 200: SubscriptionSchema },
    },
  },
  usage: {
    get: {
      method: 'GET',
      path: '/api/v1/billing/usage',
      responses: { 200: z.array(UsageSchema) },
    },
  },
  portal: {
    create: {
      method: 'POST',
      path: '/api/v1/billing/portal',
      body: z.object({}).optional(),
      responses: { 200: z.object({ url: z.string() }) },
    },
  },
  webhook: {
    handle: {
      method: 'POST',
      path: '/api/v1/billing/webhook',
      body: z.any(),
      responses: { 200: z.object({ received: z.boolean() }) },
    },
  },
});
