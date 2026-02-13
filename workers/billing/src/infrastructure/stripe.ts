import Stripe from 'stripe';

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });
}

export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  const stripe = new Stripe('', { apiVersion: '2026-01-28.clover' });
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
