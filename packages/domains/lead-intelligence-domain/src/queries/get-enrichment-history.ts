import { z } from 'zod';

export const GetEnrichmentHistoryQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type GetEnrichmentHistoryQuery = z.infer<typeof GetEnrichmentHistoryQuerySchema>;

export function getEnrichmentHistoryQuery(input: GetEnrichmentHistoryQuery): GetEnrichmentHistoryQuery {
  return GetEnrichmentHistoryQuerySchema.parse(input);
}
