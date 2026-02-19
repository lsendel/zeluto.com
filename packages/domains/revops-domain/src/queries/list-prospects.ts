import { z } from 'zod';

export const ListProspectsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  recommendation: z.enum(['enrich', 'sequence', 'skip', 'manual_review']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListProspectsQuery = z.infer<typeof ListProspectsQuerySchema>;

export function listProspectsQuery(input: ListProspectsQuery): ListProspectsQuery {
  return ListProspectsQuerySchema.parse(input);
}
