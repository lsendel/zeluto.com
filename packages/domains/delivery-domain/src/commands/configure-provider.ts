import { z } from 'zod';
import { ChannelSchema } from '../entities/delivery-job.js';
import { ProviderTypeSchema } from '../entities/provider-config.js';

export const ConfigureProviderCommandSchema = z.object({
  organizationId: z.string().uuid(),
  channel: ChannelSchema,
  providerType: ProviderTypeSchema,
  config: z.record(z.string(), z.unknown()),
  priority: z.number().int().nonnegative().optional(),
});

export type ConfigureProviderCommand = z.infer<typeof ConfigureProviderCommandSchema>;

export function configureProviderCommand(input: ConfigureProviderCommand): ConfigureProviderCommand {
  return ConfigureProviderCommandSchema.parse(input);
}
