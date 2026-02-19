import { z } from 'zod';

export const ConfigureProviderCommandSchema = z.object({
  organizationId: z.string().uuid(),
  id: z.string(),
  name: z.string(),
  providerType: z.enum(['clearbit', 'apollo', 'zoominfo', 'hunter', 'rocketreach', 'lusha', 'builtwith', 'wappalyzer']),
  supportedFields: z.array(z.string()),
  priority: z.number().int().min(0),
  costPerLookup: z.number().min(0),
  batchSupported: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export type ConfigureProviderCommand = z.infer<typeof ConfigureProviderCommandSchema>;

export function configureProviderCommand(input: ConfigureProviderCommand): ConfigureProviderCommand {
  return ConfigureProviderCommandSchema.parse(input);
}
