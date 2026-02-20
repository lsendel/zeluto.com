# Billing End-to-End Fix Design

**Date:** 2026-02-20
**Scope:** Fix critical/high billing issues to unblock end-to-end checkout, webhooks, and billing UI.
**Out of scope:** Dashboard/Campaigns/Delivery/Analytics stubs (#6), admin console nav (#8).

## Findings Addressed

| # | Severity | Summary |
|---|----------|---------|
| 1 | CRITICAL | Stripe webhooks broken (sync constructEvent, empty API key) |
| 2 | CRITICAL | Tenant middleware blocks webhook traffic |
| 3 | CRITICAL | Checkout endpoint mismatch (/checkout vs /subscription/checkout) |
| 4 | HIGH | Invalid Stripe checkout return URLs (404) |
| 5 | HIGH | Billing UI hardcoded, not connected to API |
| 7 | HIGH | HTMX forwarding missing BILLING service binding |
| 9 | MEDIUM | Subscription query nondeterministic (limit(1), no ordering) |
| 10 | MEDIUM | Webhook handler not idempotent, schema lacks uniqueness |
| 11 | MEDIUM | Billing plans not seeded |
| 12 | LOW | Quota upgrade link points to wrong path |

## Execution Order

Bottom-up: fix foundation (schema, Stripe client) first, then routing, then UI.

## Phase 1: Schema & Data Integrity (#9, #10, #11)

### Migration: `0001_billing_constraints_and_seed.sql`

**Unique constraints:**
- `subscriptions(organization_id)` - one subscription per org
- `subscriptions(stripe_subscription_id)` - no duplicate Stripe mappings
- `invoices(stripe_invoice_id)` - idempotent invoice recording
- `usage_records(organization_id, resource, period_start, period_end)` - no duplicate usage rows
- `plan_limits(plan_id, resource)` - one limit per plan/resource

**Indexes:**
- `subscriptions(stripe_customer_id)`
- `usage_records(organization_id, period_start)`

**Seed data:**
- Insert Free, Starter ($29/mo), Pro ($99/mo) plans with Stripe price IDs
- Insert plan_limits for contacts, emails_per_month, journeys per plan

**Schema file:** Add `.unique()` to `packages/domains/billing-domain/drizzle/schema.ts`.

**Query fix:** Add `.orderBy(desc(subscriptions.createdAt))` to `limit(1)` queries in `subscription-manager.ts` and `quota-checker.ts`.

### Files changed:
- `packages/domains/billing-domain/drizzle/schema.ts`
- `packages/domains/billing-domain/drizzle/migrations/0001_billing_constraints_and_seed.sql`
- `packages/domains/billing-domain/src/application/subscription-manager.ts`
- `packages/domains/billing-domain/src/services/quota-checker.ts`

## Phase 2: Stripe Client Fix (#1)

Replace `verifyStripeWebhook` in `workers/billing/src/infrastructure/stripe.ts`:
- Accept real Stripe client instance as parameter (no more `new Stripe('')`)
- Use `stripe.webhooks.constructEventAsync()` instead of sync `constructEvent()`

Update caller in `billing-routes.ts` webhook handler to pass its Stripe client.

### Files changed:
- `workers/billing/src/infrastructure/stripe.ts`
- `workers/billing/src/interface/billing-routes.ts`

## Phase 3: Webhook Handler Hardening (#10 app layer)

In `stripe-webhook-handler.ts`:
- `handleSubscriptionCreated`: Use `onConflictDoUpdate` on `organization_id`
- `handleInvoicePaid`: Use `onConflictDoNothing` on `stripe_invoice_id`
- Add explicit error logging for missing metadata (not silent return)

### Files changed:
- `packages/domains/billing-domain/src/application/stripe-webhook-handler.ts`

## Phase 4: Gateway Routing Fixes (#2, #3, #7)

**Webhook bypass (#2):** Add `/api/v1/billing/webhooks/*` to tenant middleware skip list in `workers/gateway/src/app.tsx`.

**Checkout path (#3):** Update `select-plan.tsx` form to post to `/api/v1/billing/subscription/checkout`.

**Service binding (#7):** Add `BILLING` to `getViewServiceBinding()` in `pages.tsx` for `/app/billing/*` routes. Verify binding exists in `wrangler.toml`.

### Files changed:
- `workers/gateway/src/app.tsx`
- `workers/gateway/src/views/onboarding/select-plan.tsx`
- `workers/gateway/src/routes/pages.tsx`
- `workers/gateway/wrangler.toml` (if needed)

## Phase 5: Billing UI as HTMX Fragment (#5)

New view routes in billing worker:
- `GET /app/billing` - subscription status, current plan, usage meters, upgrade/downgrade
- `GET /app/billing/invoices` - invoice history table

Views call existing billing services internally for real data. Served as HTML fragments loaded by gateway shell via HTMX.

### Files changed:
- `workers/billing/src/interface/billing-views.ts` (new)
- `workers/billing/src/index.ts` (mount view routes)

## Phase 6: Polish (#4, #12)

**Return URLs (#4):** Change defaults in `billing-routes.ts` from `/billing/success` and `/billing/cancel` to `/app/billing?checkout=success` and `/app/billing?checkout=cancel`.

**Quota link (#12):** Change `/app/settings/billing` to `/app/billing` in `workers/gateway/src/middleware/quota.ts`.

### Files changed:
- `workers/billing/src/interface/billing-routes.ts`
- `workers/gateway/src/middleware/quota.ts`

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution order | Bottom-up (schema first) | Each layer correct before dependents |
| Billing UI location | HTMX from billing worker | Consistent with CRM/Content/Journey pattern |
| Migration + seed | Combined single migration | Clean for fresh environments |
| Scope | Billing E2E only | Dashboard/campaign stubs deferred to avoid scope creep |
