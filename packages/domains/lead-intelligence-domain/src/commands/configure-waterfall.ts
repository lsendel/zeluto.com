import { z } from 'zod';

export const ConfigureWaterfallCommandSchema = z.object({
  organizationId: z.string().uuid(),
  fieldName: z.string(),
  providerOrder: z.array(z.string()).min(1),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  cacheTtlDays: z.number().int().min(0).max(365).optional(),
  maxCostPerLead: z.number().min(0).nullable().optional(),
});

export type ConfigureWaterfallCommand = z.infer<
  typeof ConfigureWaterfallCommandSchema
>;

export function configureWaterfallCommand(
  input: ConfigureWaterfallCommand,
): ConfigureWaterfallCommand {
  return ConfigureWaterfallCommandSchema.parse(input);
}
