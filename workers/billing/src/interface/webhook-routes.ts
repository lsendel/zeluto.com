import { StripeWebhookHandler } from '@mauntic/billing-domain';
import { createDatabase } from '@mauntic/worker-lib';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { verifyStripeWebhook } from '../infrastructure/stripe.js';

export const webhookRoutes = new Hono<Env>();

// POST /api/v1/billing/webhooks/stripe - Handle Stripe webhooks
webhookRoutes.post('/api/v1/billing/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'No signature provided' },
      400,
    );
  }

  const payload = await c.req.text();

  try {
    // Verify webhook signature
    const event = await verifyStripeWebhook(
      payload,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
    );

    // Handle the event
    const db = createDatabase(c.env.DATABASE_URL);
    const handler = new StripeWebhookHandler(db as any);
    await handler.handleEvent(event);

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json(
      { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed' },
      400,
    );
  }
});
