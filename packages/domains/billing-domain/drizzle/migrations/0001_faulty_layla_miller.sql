CREATE UNIQUE INDEX "invoices_stripe_invoice_id_unique" ON "billing"."invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limits_plan_resource_unique" ON "billing"."plan_limits" USING btree ("plan_id","resource");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_organization_id_unique" ON "billing"."subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_unique" ON "billing"."subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_org_resource_period_unique" ON "billing"."usage_records" USING btree ("organization_id","resource","period_start","period_end");--> statement-breakpoint
-- Seed billing plans (idempotent — skips if already seeded)
INSERT INTO billing.plans (name, display_name, price_monthly, price_yearly, is_active)
VALUES
  ('free', 'Free', 0, 0, true),
  ('starter', 'Starter', 2900, 29000, true),
  ('pro', 'Pro', 9900, 99000, true),
  ('enterprise', 'Enterprise', 0, 0, true)
ON CONFLICT (name) DO NOTHING;--> statement-breakpoint
-- Seed plan limits (uses subquery to resolve plan IDs)
INSERT INTO billing.plan_limits (plan_id, resource, limit_value)
SELECT p.id, v.resource, v.limit_value
FROM (VALUES
  ('free', 'contacts', 1000), ('free', 'emails_per_month', 5000), ('free', 'journeys', 3), ('free', 'campaigns', 10), ('free', 'team_members', 2),
  ('starter', 'contacts', 10000), ('starter', 'emails_per_month', 50000), ('starter', 'journeys', 25), ('starter', 'campaigns', 100), ('starter', 'team_members', 5),
  ('pro', 'contacts', 100000), ('pro', 'emails_per_month', 500000), ('pro', 'journeys', 200), ('pro', 'campaigns', 1000), ('pro', 'team_members', 25),
  ('enterprise', 'contacts', -1), ('enterprise', 'emails_per_month', -1), ('enterprise', 'journeys', -1), ('enterprise', 'campaigns', -1), ('enterprise', 'team_members', -1)
) AS v(plan_name, resource, limit_value)
JOIN billing.plans p ON p.name = v.plan_name
ON CONFLICT (plan_id, resource) DO NOTHING;