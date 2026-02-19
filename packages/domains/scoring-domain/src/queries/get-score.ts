import { z } from 'zod';

export const GetScoreQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type GetScoreQuery = z.infer<typeof GetScoreQuerySchema>;

export function getScoreQuery(input: GetScoreQuery): GetScoreQuery {
  return GetScoreQuerySchema.parse(input);
}
