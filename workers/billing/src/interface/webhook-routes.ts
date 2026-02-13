import { Hono } from 'hono';
import type { Env } from '../app.js';
import { StripeWebhookHandler } from '@mauntic/billing-domain';
import { createDatabase } from '../infrastructure/database.js';
import { verifyStripeWebhook } from '../infrastructure/stripe.js';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

// POST /webhooks/stripe - Handle Stripe webhooks
webhookRoutes.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ error: 'No signature provided' }, 400);
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
    const db = createDatabase(c.env.DB.connectionString);
    const handler = new StripeWebhookHandler(db as any);
    await handler.handleEvent(event);

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});
