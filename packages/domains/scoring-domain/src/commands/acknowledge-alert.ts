import { z } from 'zod';

export const AcknowledgeAlertCommandSchema = z.object({
  organizationId: z.string().uuid(),
  alertId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type AcknowledgeAlertCommand = z.infer<
  typeof AcknowledgeAlertCommandSchema
>;

export function acknowledgeAlertCommand(
  input: AcknowledgeAlertCommand,
): AcknowledgeAlertCommand {
  return AcknowledgeAlertCommandSchema.parse(input);
}
