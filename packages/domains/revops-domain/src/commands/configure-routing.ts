import { z } from 'zod';

export const ConfigureRoutingCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string(),
  strategy: z.enum(['round_robin', 'weighted', 'territory', 'skill_based', 'load_balanced']),
  targetReps: z.array(z.string()),
  conditions: z.record(z.unknown()).optional(),
  priority: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export type ConfigureRoutingCommand = z.infer<typeof ConfigureRoutingCommandSchema>;

export function configureRoutingCommand(input: ConfigureRoutingCommand): ConfigureRoutingCommand {
  return ConfigureRoutingCommandSchema.parse(input);
}
