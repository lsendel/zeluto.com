import { z } from 'zod';

export const ListSequencesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListSequencesQuery = z.infer<typeof ListSequencesQuerySchema>;

export function listSequencesQuery(input: ListSequencesQuery): ListSequencesQuery {
  return ListSequencesQuerySchema.parse(input);
}
