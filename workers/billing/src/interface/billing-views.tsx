import {
  PlanService,
  QuotaChecker,
  SubscriptionManager,
} from '@mauntic/billing-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';

export const billingViews = new Hono<Env>();

// GET /app/billing - Billing overview (HTML fragment)
billingViews.get('/app/billing', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');

  try {
    const manager = new SubscriptionManager(db, stripe);
    const quotaChecker = new QuotaChecker(db);

    const subscription = await manager.getSubscription(tenant.organizationId);
    const usage = subscription
      ? await quotaChecker.getAllUsage(tenant.organizationId)
      : [];

    let plan = null;
    if (subscription) {
      const planService = new PlanService(db);
      try {
        const result = await planService.getPlanWithLimits(
          subscription.planId,
        );
        plan = result.plan;
      } catch {
        // plan not found — show fallback
      }
    }

    const checkoutParam = new URL(c.req.url).searchParams.get('checkout');

    return c.html(
      <section class="space-y-6">
        {checkoutParam === 'success' && (
          <div class="rounded-lg border border-green-200 bg-green-50 p-4">
            <p class="text-sm font-medium text-green-800">
              Subscription activated successfully!
            </p>
          </div>
        )}
        {checkoutParam === 'cancel' && (
          <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p class="text-sm font-medium text-yellow-800">
              Checkout was cancelled.
            </p>
          </div>
        )}

        <h1 class="text-2xl font-bold text-gray-900">Billing</h1>

        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Current Plan</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">
                {plan?.displayName || 'Free'}
              </p>
              <p class="text-sm text-gray-500">
                Status:{' '}
                <span class="font-medium">
                  {subscription?.status || 'No subscription'}
                </span>
              </p>
            </div>
            {subscription?.stripeCustomerId && (
              <form method="post" action="/api/v1/billing/subscription/portal">
                <button
                  type="submit"
                  class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Manage Subscription
                </button>
              </form>
            )}
          </div>
        </div>

        {usage.length > 0 && (
          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-lg font-semibold text-gray-900">Usage</h2>
            <div class="mt-4 space-y-3">
              {usage.map((u) => (
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">{u.resource}</span>
                  <span class="text-sm font-medium text-gray-900">
                    {u.current} / {u.limit === -1 ? 'Unlimited' : u.limit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>,
    );
  } catch (error) {
    console.error('View: billing error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load billing information. Please try again.
      </div>,
      500,
    );
  }
});
