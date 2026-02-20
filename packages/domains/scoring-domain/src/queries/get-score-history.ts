import { z } from 'zod';

export const GetScoreHistoryQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(),
  limit: z.number().int().min(1).max(365).default(30),
});

export type GetScoreHistoryQuery = z.infer<typeof GetScoreHistoryQuerySchema>;

export function getScoreHistoryQuery(
  input: GetScoreHistoryQuery,
): GetScoreHistoryQuery {
  return GetScoreHistoryQuerySchema.parse(input);
}
