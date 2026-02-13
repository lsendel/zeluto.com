import { z } from 'zod';

export const StartExecutionCommandSchema = z.object({
  organizationId: z.string().uuid(),
  journeyId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type StartExecutionCommand = z.infer<typeof StartExecutionCommandSchema>;

export function startExecutionCommand(input: StartExecutionCommand): StartExecutionCommand {
  return StartExecutionCommandSchema.parse(input);
}
