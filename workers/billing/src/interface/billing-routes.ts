import {
  PlanService,
  QuotaChecker,
  SubscriptionManager,
} from '@mauntic/billing-domain';
import { invoices, plans, usageRecords } from '@mauntic/billing-domain/drizzle';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Env } from '../app.js';

export const billingRoutes = new Hono<Env>();

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

// GET /api/v1/billing/plans - List all active plans
billingRoutes.get('/api/v1/billing/plans', async (c) => {
  const db = c.get('db');

  try {
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true));

    return c.json(allPlans);
  } catch (error) {
    console.error('List plans error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list plans' },
      500,
    );
  }
});

// GET /api/v1/billing/plans/:id - Get a plan with its limits
billingRoutes.get('/api/v1/billing/plans/:id', async (c) => {
  const planId = c.req.param('id');
  const db = c.get('db');

  try {
    const planService = new PlanService(db);
    const { plan, limits } = await planService.getPlanWithLimits(planId);

    return c.json({ ...plan, limits });
  } catch (error: any) {
    if (error?.code === 'NOT_FOUND') {
      return c.json(
        { code: 'NOT_FOUND', message: `Plan ${planId} not found` },
        404,
      );
    }
    console.error('Get plan error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get plan' },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

// GET /api/v1/billing/subscription - Get current org subscription
billingRoutes.get('/api/v1/billing/subscription', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');
  const manager = new SubscriptionManager(db, stripe);

  try {
    const subscription = await manager.getSubscription(tenant.organizationId);
    if (!subscription) {
      return c.json(
        { code: 'NOT_FOUND', message: 'No subscription found' },
        404,
      );
    }
    return c.json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get subscription' },
      500,
    );
  }
});

// POST /api/v1/billing/subscription/checkout - Create Stripe checkout session
billingRoutes.post('/api/v1/billing/subscription/checkout', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');

  const body = await c.req.json<{
    planId?: string;
    plan?: string; // plan name (e.g. "starter") — resolved to planId if planId not provided
    billingPeriod: 'monthly' | 'yearly';
    successUrl?: string;
    cancelUrl?: string;
  }>();

  if ((!body.planId && !body.plan) || !body.billingPeriod) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'planId (or plan name) and billingPeriod are required',
      },
      400,
    );
  }

  // Resolve plan name to planId if needed
  let resolvedPlanId = body.planId;
  if (!resolvedPlanId && body.plan) {
    const planService = new PlanService(db);
    const activePlans = await planService.listActivePlans();
    const matched = activePlans.find((p) => p.name === body.plan);
    if (!matched) {
      return c.json(
        { code: 'NOT_FOUND', message: `Plan "${body.plan}" not found` },
        404,
      );
    }
    resolvedPlanId = matched.id;
  }

  const interval = body.billingPeriod === 'yearly' ? 'year' : 'month';
  const successUrl =
    body.successUrl || `https://${c.env.APP_DOMAIN}/app/billing?checkout=success`;
  const cancelUrl =
    body.cancelUrl || `https://${c.env.APP_DOMAIN}/app/billing?checkout=cancel`;

  const manager = new SubscriptionManager(db, stripe);

  try {
    const session = await manager.createCheckoutSession(
      tenant.organizationId,
      resolvedPlanId!,
      interval,
      successUrl,
      cancelUrl,
    );

    return c.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    if (error?.code === 'CONFLICT') {
      return c.json({ code: 'CONFLICT', message: error.message }, 400);
    }
    console.error('Checkout error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create checkout session' },
      400,
    );
  }
});

// POST /api/v1/billing/subscription/cancel - Cancel subscription
billingRoutes.post('/api/v1/billing/subscription/cancel', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');
  const manager = new SubscriptionManager(db, stripe);

  try {
    await manager.cancelSubscription(tenant.organizationId);

    // Return the updated subscription
    const subscription = await manager.getSubscription(tenant.organizationId);
    return c.json(subscription);
  } catch (error: any) {
    if (error?.message?.includes('No active subscription')) {
      return c.json(
        { code: 'NOT_FOUND', message: 'No active subscription found' },
        404,
      );
    }
    console.error('Cancel error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to cancel subscription' },
      500,
    );
  }
});

// POST /api/v1/billing/subscription/change-plan - Change subscription plan
billingRoutes.post('/api/v1/billing/subscription/change-plan', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');

  const body = await c.req.json<{
    planId: string;
    billingPeriod?: 'monthly' | 'yearly';
  }>();

  if (!body.planId) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'planId is required' },
      400,
    );
  }

  const manager = new SubscriptionManager(db, stripe);

  try {
    await manager.changeSubscription(tenant.organizationId, body.planId);

    // Return the updated subscription
    const subscription = await manager.getSubscription(tenant.organizationId);
    return c.json(subscription);
  } catch (error: any) {
    if (error?.code === 'INVARIANT_VIOLATION') {
      return c.json({ code: 'VALIDATION_ERROR', message: error.message }, 400);
    }
    if (error?.message?.includes('No active subscription')) {
      return c.json(
        { code: 'NOT_FOUND', message: 'No active subscription found' },
        404,
      );
    }
    console.error('Change plan error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to change plan' },
      500,
    );
  }
});

// POST /api/v1/billing/subscription/portal - Create Stripe billing portal session
billingRoutes.post('/api/v1/billing/subscription/portal', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');

  let returnUrl: string | undefined;
  try {
    const body = await c.req.json<{ returnUrl?: string }>();
    returnUrl = body.returnUrl;
  } catch {
    // body may be empty
  }

  const manager = new SubscriptionManager(db, stripe);
  const url = returnUrl || `https://${c.env.APP_DOMAIN}/billing`;

  try {
    const session = await manager.createPortalSession(
      tenant.organizationId,
      url,
    );
    return c.json({ url: session.url });
  } catch (error: any) {
    if (error?.message?.includes('No customer')) {
      return c.json({ code: 'NOT_FOUND', message: 'No customer found' }, 404);
    }
    console.error('Portal error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create portal session' },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

// GET /api/v1/billing/usage - Get current usage for all resources
billingRoutes.get('/api/v1/billing/usage', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const checker = new QuotaChecker(db);
    const results = await checker.getAllUsage(tenant.organizationId);

    // Map to the contract shape: { resource, current, limit, resetAt }
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);

    const usage = results.map((r) => ({
      resource: r.resource,
      current: r.current,
      limit: r.limit,
      resetAt: periodEnd.toISOString(),
    }));

    return c.json(usage);
  } catch (error) {
    console.error('Get usage error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get usage' },
      500,
    );
  }
});

// GET /api/v1/billing/usage/history - Get usage history (must be before :resource)
billingRoutes.get('/api/v1/billing/usage/history', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const resource = c.req.query('resource');
  const offset = (page - 1) * limit;

  try {
    const query = db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, tenant.organizationId))
      .orderBy(desc(usageRecords.periodStart))
      .limit(limit)
      .offset(offset);

    let records: Awaited<typeof query>;
    if (resource) {
      records = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.organizationId, tenant.organizationId),
            eq(usageRecords.resource, resource),
          ),
        )
        .orderBy(desc(usageRecords.periodStart))
        .limit(limit)
        .offset(offset);
    } else {
      records = await query;
    }

    // Get total count (simplified - just use a large number estimate)
    const allRecords = resource
      ? await db
          .select()
          .from(usageRecords)
          .where(
            and(
              eq(usageRecords.organizationId, tenant.organizationId),
              eq(usageRecords.resource, resource!),
            ),
          )
      : await db
          .select()
          .from(usageRecords)
          .where(eq(usageRecords.organizationId, tenant.organizationId));

    const total = allRecords.length;
    const totalPages = Math.ceil(total / limit);

    return c.json({
      data: records,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Get usage history error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get usage history' },
      500,
    );
  }
});

// GET /api/v1/billing/usage/:resource - Get usage for specific resource
billingRoutes.get('/api/v1/billing/usage/:resource', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const resource = c.req.param('resource');

  try {
    const checker = new QuotaChecker(db);
    const result = await checker.checkQuota(tenant.organizationId, resource);

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);

    return c.json({
      resource: result.resource,
      current: result.current,
      limit: result.limit,
      resetAt: periodEnd.toISOString(),
    });
  } catch (error) {
    console.error('Get resource usage error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get usage' },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

// GET /api/v1/billing/invoices - List invoices
billingRoutes.get('/api/v1/billing/invoices', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const records = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, tenant.organizationId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const allRecords = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, tenant.organizationId));

    const total = allRecords.length;
    const totalPages = Math.ceil(total / limit);

    return c.json({
      data: records,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('List invoices error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list invoices' },
      500,
    );
  }
});

// GET /api/v1/billing/invoices/:id - Get invoice
billingRoutes.get('/api/v1/billing/invoices/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const invoiceId = c.req.param('id');

  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.organizationId, tenant.organizationId),
        ),
      )
      .limit(1);

    if (!invoice) {
      return c.json({ code: 'NOT_FOUND', message: 'Invoice not found' }, 404);
    }

    return c.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get invoice' },
      500,
    );
  }
});
