import { z } from 'zod';

export const ConfigureScoringCommandSchema = z.object({
  organizationId: z.string().uuid(),
  configs: z.array(
    z.object({
      category: z.string(),
      factor: z.string(),
      weight: z.number(),
      enabled: z.boolean().default(true),
    }),
  ),
});

export type ConfigureScoringCommand = z.infer<
  typeof ConfigureScoringCommandSchema
>;

export function configureScoringCommand(
  input: ConfigureScoringCommand,
): ConfigureScoringCommand {
  return ConfigureScoringCommandSchema.parse(input);
}
