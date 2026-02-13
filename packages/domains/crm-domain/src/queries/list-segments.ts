import { z } from 'zod';

export const ListSegmentsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListSegmentsQuery = z.infer<typeof ListSegmentsQuerySchema>;

export function listSegmentsQuery(input: ListSegmentsQuery): ListSegmentsQuery {
  return ListSegmentsQuerySchema.parse(input);
}
