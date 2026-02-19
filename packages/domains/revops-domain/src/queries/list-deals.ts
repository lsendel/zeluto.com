import { z } from 'zod';

export const ListDealsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  stage: z.string().optional(),
  assignedRep: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListDealsQuery = z.infer<typeof ListDealsQuerySchema>;

export function listDealsQuery(input: ListDealsQuery): ListDealsQuery {
  return ListDealsQuerySchema.parse(input);
}
