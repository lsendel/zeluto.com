import { z } from 'zod';

export const ExecuteStepCommandSchema = z.object({
  organizationId: z.string().uuid(),
  executionId: z.string().uuid(),
  stepId: z.string().uuid(),
});

export type ExecuteStepCommand = z.infer<typeof ExecuteStepCommandSchema>;

export function executeStepCommand(
  input: ExecuteStepCommand,
): ExecuteStepCommand {
  return ExecuteStepCommandSchema.parse(input);
}
