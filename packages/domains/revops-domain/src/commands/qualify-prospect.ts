import { z } from 'zod';

export const QualifyProspectCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type QualifyProspectCommand = z.infer<
  typeof QualifyProspectCommandSchema
>;

export function qualifyProspectCommand(
  input: QualifyProspectCommand,
): QualifyProspectCommand {
  return QualifyProspectCommandSchema.parse(input);
}
