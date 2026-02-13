import Stripe from 'stripe';

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
}

export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  const stripe = new Stripe('', { apiVersion: '2025-02-24.acacia' });
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
