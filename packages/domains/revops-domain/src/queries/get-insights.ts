import { z } from 'zod';

export const GetInsightsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  insightType: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type GetInsightsQuery = z.infer<typeof GetInsightsQuerySchema>;

export function getInsightsQuery(input: GetInsightsQuery): GetInsightsQuery {
  return GetInsightsQuerySchema.parse(input);
}
