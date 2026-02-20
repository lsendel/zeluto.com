CREATE UNIQUE INDEX "invoices_stripe_invoice_id_unique" ON "billing"."invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limits_plan_resource_unique" ON "billing"."plan_limits" USING btree ("plan_id","resource");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_organization_id_unique" ON "billing"."subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_unique" ON "billing"."subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_org_resource_period_unique" ON "billing"."usage_records" USING btree ("organization_id","resource","period_start","period_end");--> statement-breakpoint

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