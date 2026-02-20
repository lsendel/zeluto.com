import { z } from 'zod';

export const EnrichContactCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  fields: z.array(z.string()).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type EnrichContactCommand = z.infer<typeof EnrichContactCommandSchema>;

export function enrichContactCommand(
  input: EnrichContactCommand,
): EnrichContactCommand {
  return EnrichContactCommandSchema.parse(input);
}
