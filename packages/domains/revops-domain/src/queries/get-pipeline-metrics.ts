import { z } from 'zod';

export const GetPipelineMetricsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  period: z.string().optional(), // e.g. "2026-Q1"
});

export type GetPipelineMetricsQuery = z.infer<
  typeof GetPipelineMetricsQuerySchema
>;

export function getPipelineMetricsQuery(
  input: GetPipelineMetricsQuery,
): GetPipelineMetricsQuery {
  return GetPipelineMetricsQuerySchema.parse(input);
}
