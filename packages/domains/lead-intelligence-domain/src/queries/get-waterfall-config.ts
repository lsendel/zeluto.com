import { z } from 'zod';

export const GetWaterfallConfigQuerySchema = z.object({
  organizationId: z.string().uuid(),
  fieldName: z.string().optional(),
});

export type GetWaterfallConfigQuery = z.infer<
  typeof GetWaterfallConfigQuerySchema
>;

export function getWaterfallConfigQuery(
  input: GetWaterfallConfigQuery,
): GetWaterfallConfigQuery {
  return GetWaterfallConfigQuerySchema.parse(input);
}
