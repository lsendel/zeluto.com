import { pgSchema, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const billingSchema = pgSchema('billing');

export const plans = billingSchema.table('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(), // "free", "starter", "pro", "enterprise"
  displayName: varchar('display_name', { length: 100 }).notNull(),
  priceMonthly: integer('price_monthly').notNull(), // cents
  priceYearly: integer('price_yearly').notNull(), // cents
  stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 255 }),
  stripePriceIdYearly: varchar('stripe_price_id_yearly', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const planLimits = billingSchema.table('plan_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  resource: varchar('resource', { length: 50 }).notNull(), // contacts, emails_per_month, journeys, campaigns, team_members, integrations, storage_bytes, api_calls_per_month
  limitValue: integer('limit_value').notNull(), // -1 = unlimited
});

export const subscriptions = billingSchema.table('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: varchar('status', { length: 20 }).notNull(), // active, past_due, canceled, trialing
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  trialEnd: timestamp('trial_end'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageRecords = billingSchema.table('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  resource: varchar('resource', { length: 50 }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  currentValue: integer('current_value').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoices = billingSchema.table('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
