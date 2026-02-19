import { z } from 'zod';

export const ListAlertsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(['open', 'acknowledged', 'expired']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListAlertsQuery = z.infer<typeof ListAlertsQuerySchema>;

export function listAlertsQuery(input: ListAlertsQuery): ListAlertsQuery {
  return ListAlertsQuerySchema.parse(input);
}
