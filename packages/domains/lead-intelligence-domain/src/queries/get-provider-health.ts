import { z } from 'zod';

export const GetProviderHealthQuerySchema = z.object({
  organizationId: z.string().uuid(),
  providerId: z.string().optional(),
});

export type GetProviderHealthQuery = z.infer<typeof GetProviderHealthQuerySchema>;

export function getProviderHealthQuery(input: GetProviderHealthQuery): GetProviderHealthQuery {
  return GetProviderHealthQuerySchema.parse(input);
}
