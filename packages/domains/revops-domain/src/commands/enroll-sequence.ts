import { z } from 'zod';

export const EnrollSequenceCommandSchema = z.object({
  organizationId: z.string().uuid(),
  sequenceId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type EnrollSequenceCommand = z.infer<typeof EnrollSequenceCommandSchema>;

export function enrollSequenceCommand(
  input: EnrollSequenceCommand,
): EnrollSequenceCommand {
  return EnrollSequenceCommandSchema.parse(input);
}
