import { z } from 'zod';

export const ListContactsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  segmentId: z.string().uuid().optional(),
});

export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

export function listContactsQuery(input: ListContactsQuery): ListContactsQuery {
  return ListContactsQuerySchema.parse(input);
}
