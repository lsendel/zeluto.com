import { z } from 'zod';

export const RunResearchCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  type: z.enum(['company', 'person']),
});

export type RunResearchCommand = z.infer<typeof RunResearchCommandSchema>;

export function runResearchCommand(
  input: RunResearchCommand,
): RunResearchCommand {
  return RunResearchCommandSchema.parse(input);
}
