import { z } from 'zod';

export const ListCompaniesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type ListCompaniesQuery = z.infer<typeof ListCompaniesQuerySchema>;

export function listCompaniesQuery(input: ListCompaniesQuery): ListCompaniesQuery {
  return ListCompaniesQuerySchema.parse(input);
}
