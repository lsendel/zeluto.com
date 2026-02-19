import { z } from 'zod';

export const GetDealQuerySchema = z.object({
  organizationId: z.string().uuid(),
  dealId: z.string().uuid(),
});

export type GetDealQuery = z.infer<typeof GetDealQuerySchema>;

export function getDealQuery(input: GetDealQuery): GetDealQuery {
  return GetDealQuerySchema.parse(input);
}
