import { Hono } from 'hono';
import type { Env } from '../app.js';
import { SubscriptionManager, QuotaChecker } from '@mauntic/billing-domain';
import { createDatabase } from '../infrastructure/database.js';
import { createStripeClient } from '../infrastructure/stripe.js';

export const billingRoutes = new Hono<{ Bindings: Env }>();

// POST /billing/checkout - Create checkout session
billingRoutes.post('/checkout', async (c) => {
  const { organizationId, planId, interval } = await c.req.json();

  if (!organizationId || !planId || !interval) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);

  const successUrl = `https://${c.env.APP_DOMAIN}/billing/success`;
  const cancelUrl = `https://${c.env.APP_DOMAIN}/billing/cancel`;

  try {
    const session = await manager.createCheckoutSession(
      organizationId,
      planId,
      interval,
      successUrl,
      cancelUrl,
    );

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// POST /billing/portal - Create customer portal session
billingRoutes.post('/portal', async (c) => {
  const { organizationId } = await c.req.json();

  if (!organizationId) {
    return c.json({ error: 'Missing organizationId' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);

  const returnUrl = `https://${c.env.APP_DOMAIN}/billing`;

  try {
    const session = await manager.createPortalSession(organizationId, returnUrl);
    return c.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

// GET /billing/subscription/:organizationId - Get subscription
billingRoutes.get('/subscription/:organizationId', async (c) => {
  const organizationId = c.req.param('organizationId');

  const db = createDatabase(c.env.DB.connectionString);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);

  try {
    const subscription = await manager.getSubscription(organizationId);
    return c.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json({ error: 'Failed to get subscription' }, 500);
  }
});

// POST /billing/cancel - Cancel subscription
billingRoutes.post('/cancel', async (c) => {
  const { organizationId } = await c.req.json();

  if (!organizationId) {
    return c.json({ error: 'Missing organizationId' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);

  try {
    await manager.cancelSubscription(organizationId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Cancel error:', error);
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }
});

// POST /billing/change - Change subscription plan
billingRoutes.post('/change', async (c) => {
  const { organizationId, newPlanId } = await c.req.json();

  if (!organizationId || !newPlanId) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);

  try {
    await manager.changeSubscription(organizationId, newPlanId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Change plan error:', error);
    return c.json({ error: 'Failed to change subscription' }, 500);
  }
});

// POST /billing/check-quota - Check quota for resource
billingRoutes.post('/check-quota', async (c) => {
  const { organizationId, resource } = await c.req.json();

  if (!organizationId || !resource) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const checker = new QuotaChecker(db as any);

  try {
    const result = await checker.checkQuota(organizationId, resource);
    return c.json(result);
  } catch (error) {
    console.error('Check quota error:', error);
    return c.json({ error: 'Failed to check quota' }, 500);
  }
});

// POST /billing/increment-usage - Increment usage for resource
billingRoutes.post('/increment-usage', async (c) => {
  const { organizationId, resource, amount } = await c.req.json();

  if (!organizationId || !resource) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = createDatabase(c.env.DB.connectionString);
  const checker = new QuotaChecker(db as any);

  try {
    await checker.incrementUsage(organizationId, resource, amount || 1);
    return c.json({ success: true });
  } catch (error) {
    console.error('Increment usage error:', error);
    return c.json({ error: 'Failed to increment usage' }, 500);
  }
});
