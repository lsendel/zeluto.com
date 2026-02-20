# Billing End-to-End Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical/high billing issues so that Stripe webhooks, checkout, and billing UI work end-to-end.

**Architecture:** Bottom-up fix order — DB schema constraints first, then Stripe client, webhook handler, gateway routing, billing UI, and polish. Each layer is correct before the next depends on it.

**Tech Stack:** Drizzle ORM (Neon PostgreSQL), Stripe SDK (`constructEventAsync`), Hono (Cloudflare Workers), HTMX (SSR fragments)

---

### Task 1: Add unique constraints and indexes to billing schema

**Files:**
- Modify: `packages/domains/billing-domain/drizzle/schema.ts`

**Context:** The billing schema has no unique constraints on `subscriptions.organization_id`, `subscriptions.stripe_subscription_id`, `invoices.stripe_invoice_id`, `usage_records(org+resource+period)`, or `plan_limits(plan_id+resource)`. This allows duplicate rows and makes webhook handling non-idempotent.

**Step 1: Add unique constraints to schema.ts**

In `packages/domains/billing-domain/drizzle/schema.ts`, add unique constraints and indexes. Drizzle uses the table-level `unique()` and `index()` helpers or column-level `.unique()`.

For `subscriptions` table, add a unique constraint on `organizationId` and on `stripeSubscriptionId`:
```typescript
import { boolean, integer, pgSchema, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const subscriptions = billingSchema.table('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: varchar('status', { length: 20 }).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  trialEnd: timestamp('trial_end'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('subscriptions_organization_id_unique').on(table.organizationId),
  uniqueIndex('subscriptions_stripe_subscription_id_unique').on(table.stripeSubscriptionId),
]);
```

For `invoices` table, add unique on `stripeInvoiceId`:
```typescript
export const invoices = billingSchema.table('invoices', {
  // ... existing columns ...
}, (table) => [
  uniqueIndex('invoices_stripe_invoice_id_unique').on(table.stripeInvoiceId),
]);
```

For `usageRecords` table, add composite unique on `(organizationId, resource, periodStart, periodEnd)`:
```typescript
export const usageRecords = billingSchema.table('usage_records', {
  // ... existing columns ...
}, (table) => [
  uniqueIndex('usage_records_org_resource_period_unique').on(
    table.organizationId,
    table.resource,
    table.periodStart,
    table.periodEnd,
  ),
]);
```

For `planLimits` table, add composite unique on `(planId, resource)`:
```typescript
export const planLimits = billingSchema.table('plan_limits', {
  // ... existing columns ...
}, (table) => [
  uniqueIndex('plan_limits_plan_resource_unique').on(table.planId, table.resource),
]);
```

**Step 2: Generate Drizzle migration**

Run: `cd packages/domains/billing-domain && npx drizzle-kit generate`
Expected: New migration file created in `drizzle/migrations/`

**Step 3: Add seed data to the generated migration**

Append to the generated migration SQL file (after the constraint statements):

```sql
-- Seed billing plans
INSERT INTO billing.plans (id, name, display_name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'free', 'Free', 0, 0, NULL, NULL, true),
  ('00000000-0000-0000-0000-000000000002', 'starter', 'Starter', 2900, 29000, NULL, NULL, true),
  ('00000000-0000-0000-0000-000000000003', 'pro', 'Pro', 9900, 99000, NULL, NULL, true)
ON CONFLICT (name) DO NOTHING;

-- Seed plan limits
INSERT INTO billing.plan_limits (plan_id, resource, limit_value)
VALUES
  -- Free plan
  ('00000000-0000-0000-0000-000000000001', 'contacts', 500),
  ('00000000-0000-0000-0000-000000000001', 'emails_per_month', 1000),
  ('00000000-0000-0000-0000-000000000001', 'journeys', 3),
  -- Starter plan
  ('00000000-0000-0000-0000-000000000002', 'contacts', 5000),
  ('00000000-0000-0000-0000-000000000002', 'emails_per_month', 25000),
  ('00000000-0000-0000-0000-000000000002', 'journeys', 20),
  -- Pro plan
  ('00000000-0000-0000-0000-000000000003', 'contacts', 50000),
  ('00000000-0000-0000-0000-000000000003', 'emails_per_month', 250000),
  ('00000000-0000-0000-0000-000000000003', 'journeys', -1)
ON CONFLICT (plan_id, resource) DO NOTHING;
```

Note: `stripe_price_id_monthly` and `stripe_price_id_yearly` are NULL — fill them in when Stripe products are created. The plan IDs use deterministic UUIDs so references are stable.

**Step 4: Run migration against dev database**

Run: `cd packages/domains/billing-domain && npx drizzle-kit migrate`
Expected: Migration applies successfully. Verify with `npx drizzle-kit studio` or run a quick SQL check.

**Step 5: Commit**

```bash
git add packages/domains/billing-domain/drizzle/
git commit -m "feat(billing): add unique constraints, indexes, and seed plans"
```

---

### Task 2: Fix subscription queries to be deterministic (#9)

**Files:**
- Modify: `packages/domains/billing-domain/src/application/subscription-manager.ts`
- Modify: `packages/domains/billing-domain/src/services/quota-checker.ts`

**Context:** Multiple `limit(1)` queries select subscriptions without ordering. With the new unique constraint on `organization_id` this is technically safe for subscription queries (only one row per org), but we should still add `orderBy` for defensive correctness. The `planLimits` and `usageRecords` queries use composite unique constraints, so `limit(1)` is fine there.

**Step 1: Add orderBy to subscription queries in subscription-manager.ts**

There are 4 `limit(1)` queries on `subscriptions` in `subscription-manager.ts` (lines ~70, ~102, ~170, ~183). Add `.orderBy(desc(subscriptions.createdAt))` before `.limit(1)` in each:

```typescript
import { desc } from 'drizzle-orm';
// ... in each query:
const [subscription] = await this.db
  .select()
  .from(subscriptions)
  .where(eq(subscriptions.organizationId, organizationId))
  .orderBy(desc(subscriptions.createdAt))
  .limit(1);
```

**Step 2: Add orderBy to subscription queries in quota-checker.ts**

There are 2 subscription queries in `quota-checker.ts` (lines ~25, ~145). Same fix:

```typescript
import { desc } from 'drizzle-orm';
// ... in each query:
const [subscription] = await this.db
  .select()
  .from(subscriptions)
  .where(eq(subscriptions.organizationId, organizationId))
  .orderBy(desc(subscriptions.createdAt))
  .limit(1);
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/domains/billing-domain && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/domains/billing-domain/src/
git commit -m "fix(billing): add deterministic ordering to subscription queries"
```

---

### Task 3: Fix Stripe webhook verification (#1)

**Files:**
- Modify: `workers/billing/src/infrastructure/stripe.ts`
- Modify: `workers/billing/src/interface/webhook-routes.ts`

**Context:** `verifyStripeWebhook` creates `new Stripe('')` (empty API key) and uses sync `constructEvent()`. In Cloudflare Workers, only `constructEventAsync()` works. The fix: accept a real Stripe client and use the async method.

**Step 1: Rewrite verifyStripeWebhook in stripe.ts**

Replace the entire `verifyStripeWebhook` function:

```typescript
export async function verifyStripeWebhook(
  stripe: Stripe,
  payload: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return await stripe.webhooks.constructEventAsync(payload, signature, secret);
}
```

**Step 2: Update webhook-routes.ts to pass Stripe client**

In `workers/billing/src/interface/webhook-routes.ts`, the webhook handler needs to create a Stripe client and pass it:

```typescript
import { createStripeClient, verifyStripeWebhook } from '../infrastructure/stripe.js';

// ... inside the handler:
const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
const event = await verifyStripeWebhook(
  stripe,
  payload,
  signature,
  c.env.STRIPE_WEBHOOK_SECRET,
);
```

The current code at line 24 calls `verifyStripeWebhook(payload, signature, c.env.STRIPE_WEBHOOK_SECRET)` — add `stripe` as the first argument and import `createStripeClient`.

**Step 3: Verify TypeScript compiles**

Run: `cd workers/billing && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add workers/billing/src/infrastructure/stripe.ts workers/billing/src/interface/webhook-routes.ts
git commit -m "fix(billing): use constructEventAsync with real Stripe client for webhooks"
```

---

### Task 4: Make webhook handler idempotent (#10)

**Files:**
- Modify: `packages/domains/billing-domain/src/application/stripe-webhook-handler.ts`

**Context:** `handleSubscriptionCreated` does a blind `insert` that will fail on duplicate `organization_id` (now that we have the unique constraint). `handleInvoicePaid` does a blind `insert` that will fail on duplicate `stripe_invoice_id`. Both need upsert behavior.

**Step 1: Change handleSubscriptionCreated to use onConflictDoUpdate**

Replace the `insert` at line 128 with:

```typescript
await this.db
  .insert(subscriptions)
  .values({
    organizationId: orgId,
    planId,
    status: mapStatus(subscription.status),
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: new Date(
      ((subscription as any).current_period_start || 0) * 1000,
    ),
    currentPeriodEnd: new Date(
      ((subscription as any).current_period_end || 0) * 1000,
    ),
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  })
  .onConflictDoUpdate({
    target: subscriptions.organizationId,
    set: {
      planId,
      status: mapStatus(subscription.status),
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(
        ((subscription as any).current_period_start || 0) * 1000,
      ),
      currentPeriodEnd: new Date(
        ((subscription as any).current_period_end || 0) * 1000,
      ),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      updatedAt: new Date(),
    },
  });
```

**Step 2: Change handleInvoicePaid to use onConflictDoNothing**

Replace the `insert` at line 52 with:

```typescript
await this.db
  .insert(invoices)
  .values({
    organizationId: orgId,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid,
    status: invoice.status || 'paid',
    periodStart: invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : null,
    periodEnd: invoice.period_end
      ? new Date(invoice.period_end * 1000)
      : null,
    paidAt: new Date(),
  })
  .onConflictDoNothing({
    target: invoices.stripeInvoiceId,
  });
```

**Step 3: Improve missing metadata logging**

Replace the silent `console.warn` + `return` pattern with explicit error logging:

In `handleInvoicePaid` (line 47):
```typescript
if (!orgId) {
  console.error(`[webhook] invoice.paid ${invoice.id}: missing organizationId in metadata`);
  return;
}
```

In `handleSubscriptionCreated` (line 108):
```typescript
if (!orgId || !planId) {
  console.error(`[webhook] subscription.created ${subscription.id}: missing metadata (orgId=${orgId}, planId=${planId})`);
  return;
}
```

**Step 4: Verify TypeScript compiles**

Run: `cd packages/domains/billing-domain && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/domains/billing-domain/src/application/stripe-webhook-handler.ts
git commit -m "fix(billing): make webhook handler idempotent with upsert patterns"
```

---

### Task 5: Fix gateway tenant middleware bypass for webhooks (#2)

**Files:**
- Modify: `workers/gateway/src/app.tsx` (line 44)

**Context:** `app.use('/api/v1/*', tenantMiddleware())` on line 44 applies to ALL `/api/v1/*` routes, including `/api/v1/billing/webhooks/stripe`. The auth middleware already skips this path (it's in `PUBLIC_PREFIXES`), but the tenant middleware doesn't. Stripe webhook calls have no session/tenant context.

**Step 1: Add path exclusion to tenant middleware**

Replace line 44:
```typescript
app.use('/api/v1/*', tenantMiddleware());
```

With:
```typescript
app.use('/api/v1/*', async (c, next) => {
  // Skip tenant context for Stripe webhooks — they have no user session
  if (c.req.path.startsWith('/api/v1/billing/webhooks/')) {
    return next();
  }
  return tenantMiddleware()(c, next);
});
```

This matches the pattern used for the `/app/*` tenant middleware skip (lines 45-52).

**Step 2: Verify TypeScript compiles**

Run: `cd workers/gateway && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add workers/gateway/src/app.tsx
git commit -m "fix(gateway): skip tenant middleware for Stripe webhook path"
```

---

### Task 6: Fix checkout endpoint mismatch (#3)

**Files:**
- Modify: `workers/gateway/src/views/onboarding/select-plan.tsx` (line ~199)

**Context:** The onboarding select-plan form posts to `/api/v1/billing/checkout`, but the billing worker only serves `/api/v1/billing/subscription/checkout`. The request hits the gateway billing route catch-all, gets forwarded to the billing worker, but 404s there.

**Step 1: Fix the form action URL**

In `workers/gateway/src/views/onboarding/select-plan.tsx`, find:
```tsx
hx-post="/api/v1/billing/checkout"
```

Replace with:
```tsx
hx-post="/api/v1/billing/subscription/checkout"
```

Also update the `hx-vals` to match the billing worker's expected body format. The billing worker expects `{ planId, billingPeriod }` but the form sends `{ plan, interval }`. Update to:
```tsx
hx-vals={`{"planId": "${plan.id}", "billingPeriod": "monthly"}`}
```

Note: This requires the plan objects to have `id` values. Check if `select-plan.tsx` uses plan IDs or names. If it uses names, we need to either pass the plan ID from the seed data or have the billing worker accept plan names.

**Step 2: Verify TypeScript compiles**

Run: `cd workers/gateway && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add workers/gateway/src/views/onboarding/select-plan.tsx
git commit -m "fix(gateway): correct checkout endpoint path to match billing worker"
```

---

### Task 7: Add BILLING service binding for HTMX views (#7)

**Files:**
- Modify: `workers/gateway/src/routes/pages.tsx` (function `getViewServiceBinding`)

**Context:** `getViewServiceBinding()` at lines 146-157 maps URL paths to service bindings for HTMX view fragments. Only CRM, CONTENT, and JOURNEY are mapped. Billing pages fall through to the stub renderer. We need to add BILLING.

**Step 1: Add BILLING binding to getViewServiceBinding**

In `workers/gateway/src/routes/pages.tsx`, in `getViewServiceBinding()`, add before the `return null`:

```typescript
if (path.startsWith('/app/billing')) {
  return c.env.BILLING;
}
```

**Step 2: Remove the hardcoded billing stub**

In the same file, remove the billing stub block (lines ~372-385):
```tsx
// DELETE this entire block:
if (path.startsWith('/app/billing')) {
  return c.html(
    <section class="space-y-6">
      ...
    </section>,
  );
}
```

This is necessary so billing requests go through the HTMX service forwarding path instead of hitting the stub.

**Step 3: Verify TypeScript compiles**

Run: `cd workers/gateway && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add workers/gateway/src/routes/pages.tsx
git commit -m "feat(gateway): add BILLING service binding for HTMX view routes"
```

---

### Task 8: Create billing view routes in billing worker (#5)

**Files:**
- Create: `workers/billing/src/interface/billing-views.ts`
- Modify: `workers/billing/src/app.ts` (mount view routes)

**Context:** The billing UI should serve real data as HTMX fragments, consistent with how CRM/Content/Journey workers serve their views. The billing worker already has all the application services (SubscriptionManager, QuotaChecker, PlanService).

**Step 1: Create billing-views.ts**

Create `workers/billing/src/interface/billing-views.ts`:

```tsx
import {
  PlanService,
  QuotaChecker,
  SubscriptionManager,
} from '@mauntic/billing-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { createDatabase } from '@mauntic/worker-lib';
import { createStripeClient } from '../infrastructure/stripe.js';

export const billingViews = new Hono<Env>();

billingViews.get('/app/billing', async (c) => {
  const orgId = c.req.header('x-organization-id');
  if (!orgId) {
    return c.html(<p class="text-sm text-gray-500">No organization context</p>);
  }

  const db = createDatabase(c.env.DATABASE_URL);
  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const manager = new SubscriptionManager(db as any, stripe);
  const quotaChecker = new QuotaChecker(db as any);

  const subscription = await manager.getSubscription(orgId);
  const usage = subscription ? await quotaChecker.getAllUsage(orgId) : [];

  // Get plan details if subscription exists
  let plan = null;
  if (subscription) {
    const planService = new PlanService(db as any);
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
          <p class="text-sm font-medium text-green-800">Subscription activated successfully!</p>
        </div>
      )}
      {checkoutParam === 'cancel' && (
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p class="text-sm font-medium text-yellow-800">Checkout was cancelled.</p>
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
              Status: <span class="font-medium">{subscription?.status || 'No subscription'}</span>
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
            {usage.map((u: any) => (
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
});
```

Note: The exact JSX will depend on your ui-kit patterns. Adapt the HTML classes and structure to match existing views in the codebase. The key point is: call real services, return real data.

**Step 2: Mount view routes in app.ts**

In `workers/billing/src/app.ts`, import and mount the billing views:

```typescript
import { billingViews } from './interface/billing-views.js';

// After the existing route mounts (line ~93):
app.route('/', billingViews);
```

**Step 3: Verify TypeScript compiles**

Run: `cd workers/billing && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add workers/billing/src/interface/billing-views.ts workers/billing/src/app.ts
git commit -m "feat(billing): add HTMX view routes for billing page with real data"
```

---

### Task 9: Fix checkout return URLs (#4) and quota upgrade link (#12)

**Files:**
- Modify: `workers/billing/src/interface/billing-routes.ts` (lines ~116-118)
- Modify: `workers/gateway/src/middleware/quota.ts` (line ~104)

**Context:** Checkout return URLs default to `/billing/success` and `/billing/cancel` which are 404s. Quota middleware links to `/app/settings/billing` which doesn't exist.

**Step 1: Fix checkout return URL defaults**

In `workers/billing/src/interface/billing-routes.ts`, find (lines ~116-118):
```typescript
const successUrl =
  body.successUrl || `https://${c.env.APP_DOMAIN}/billing/success`;
const cancelUrl =
  body.cancelUrl || `https://${c.env.APP_DOMAIN}/billing/cancel`;
```

Replace with:
```typescript
const successUrl =
  body.successUrl || `https://${c.env.APP_DOMAIN}/app/billing?checkout=success`;
const cancelUrl =
  body.cancelUrl || `https://${c.env.APP_DOMAIN}/app/billing?checkout=cancel`;
```

**Step 2: Fix quota upgrade link**

In `workers/gateway/src/middleware/quota.ts`, find (line ~104):
```typescript
upgradeUrl: '/app/settings/billing',
```

Replace with:
```typescript
upgradeUrl: '/app/billing',
```

**Step 3: Verify TypeScript compiles**

Run both:
- `cd workers/billing && npx tsc --noEmit`
- `cd workers/gateway && npx tsc --noEmit`
Expected: No errors for both

**Step 4: Commit**

```bash
git add workers/billing/src/interface/billing-routes.ts workers/gateway/src/middleware/quota.ts
git commit -m "fix(billing): correct checkout return URLs and quota upgrade link"
```

---

### Task 10: Integration smoke test

**Context:** All code changes are in place. Verify the full flow works.

**Step 1: Build packages**

```bash
cd packages/domains/billing-domain && pnpm build
cd packages/worker-lib && pnpm build
cd packages/ui-kit && pnpm build
```

**Step 2: Deploy billing worker**

```bash
cd workers/billing && npx wrangler deploy
```

**Step 3: Deploy gateway**

```bash
cd workers/gateway && npx wrangler deploy
```

**Step 4: Manual verification checklist**

- [ ] Visit `/app/billing` — should show real subscription data (or "No subscription" for free users)
- [ ] Check `/api/v1/billing/plans` returns seeded plans
- [ ] Test Stripe webhook with `stripe trigger invoice.paid` — should not 500
- [ ] Test checkout: select a paid plan in onboarding — should redirect to Stripe
- [ ] After checkout, verify return URL goes to `/app/billing?checkout=success`
- [ ] Verify quota exceeded response shows `upgradeUrl: '/app/billing'`

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(billing): integration fixes from smoke testing"
```
