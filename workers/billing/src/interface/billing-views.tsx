import {
  PlanService,
  QuotaChecker,
  SubscriptionManager,
} from '@mauntic/billing-domain';
import type { QuotaCheckResult } from '@mauntic/billing-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';

export const billingViews = new Hono<Env>();

billingViews.get('/app/billing', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const stripe = c.get('stripe');

  if (!tenant?.organizationId) {
    return c.html(<p class="text-sm text-gray-500">No organization context</p>);
  }

  const orgId = tenant.organizationId;
  const manager = new SubscriptionManager(db, stripe);
  const quotaChecker = new QuotaChecker(db);

  const subscription = await manager.getSubscription(orgId);
  const usage = subscription ? await quotaChecker.getAllUsage(orgId) : [];

  let plan: { displayName: string } | null = null;
  if (subscription) {
    const planService = new PlanService(db);
    try {
      const result = await planService.getPlanWithLimits(subscription.planId);
      plan = result.plan;
    } catch {
      // plan not found
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
            <button
              hx-post="/api/v1/billing/subscription/portal"
              hx-vals='{"returnUrl": "/app/billing"}'
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>

      {usage.length > 0 && (
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-gray-900">Usage</h2>
          <div class="mt-4 space-y-3">
            {usage.map((u: QuotaCheckResult) => {
              const pct =
                u.limit === -1 ? 0 : Math.min(100, (u.current / u.limit) * 100);
              return (
                <div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">{u.resource}</span>
                    <span class="font-medium text-gray-900">
                      {u.current.toLocaleString()} /{' '}
                      {u.limit === -1 ? 'Unlimited' : u.limit.toLocaleString()}
                    </span>
                  </div>
                  {u.limit !== -1 && (
                    <div class="mt-1 h-2 w-full rounded-full bg-gray-100">
                      <div
                        class={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                        style={`width: ${pct}%`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>,
  );
});
