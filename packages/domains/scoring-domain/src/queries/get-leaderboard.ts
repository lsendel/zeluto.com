import { z } from 'zod';

export const GetLeaderboardQuerySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
});

export type GetLeaderboardQuery = z.infer<typeof GetLeaderboardQuerySchema>;

export function getLeaderboardQuery(input: GetLeaderboardQuery): GetLeaderboardQuery {
  return GetLeaderboardQuerySchema.parse(input);
}
