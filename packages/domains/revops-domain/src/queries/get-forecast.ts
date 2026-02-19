import { z } from 'zod';

export const GetForecastQuerySchema = z.object({
  organizationId: z.string().uuid(),
  period: z.string(),
  repId: z.string().uuid().optional(),
});

export type GetForecastQuery = z.infer<typeof GetForecastQuerySchema>;

export function getForecastQuery(input: GetForecastQuery): GetForecastQuery {
  return GetForecastQuerySchema.parse(input);
}
