import { z } from 'zod';

export const ConfigureSignalCommandSchema = z.object({
  organizationId: z.string().uuid(),
  signalType: z.string(),
  weight: z.number().min(0).optional(),
  decayHours: z.number().int().min(0).optional(),
  tier: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  enabled: z.boolean().optional(),
});

export type ConfigureSignalCommand = z.infer<typeof ConfigureSignalCommandSchema>;

export function configureSignalCommand(input: ConfigureSignalCommand): ConfigureSignalCommand {
  return ConfigureSignalCommandSchema.parse(input);
}
