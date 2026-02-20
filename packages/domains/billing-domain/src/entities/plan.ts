import { z } from 'zod';

export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(), // "free", "starter", "pro", "enterprise"
  displayName: z.string(),
  priceMonthly: z.number().int(), // cents
  priceYearly: z.number().int(), // cents
  stripePriceIdMonthly: z.string().nullable(),
  stripePriceIdYearly: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export type Plan = z.infer<typeof PlanSchema>;

export const PlanLimitSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  resource: z.string(), // contacts, emails_per_month, journeys, campaigns, team_members, integrations, storage_bytes, api_calls_per_month
  limitValue: z.number().int(), // -1 = unlimited
});

export type PlanLimit = z.infer<typeof PlanLimitSchema>;

export const CreatePlanSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
  limits: z.array(
    z.object({
      resource: z.string(),
      limitValue: z.number().int(),
    }),
  ),
});

export type CreatePlan = z.infer<typeof CreatePlanSchema>;
