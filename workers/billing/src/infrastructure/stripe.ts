import Stripe from 'stripe';

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });
}

export async function verifyStripeWebhook(
  stripe: Stripe,
  payload: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return await stripe.webhooks.constructEventAsync(payload, signature, secret);
}
