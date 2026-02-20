import { z } from 'zod';
import { SuppressionReasonSchema } from '../entities/suppression-entry.js';

export const AddSuppressionCommandSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  reason: SuppressionReasonSchema,
  source: z.string().optional(),
});

export type AddSuppressionCommand = z.infer<typeof AddSuppressionCommandSchema>;

export function addSuppressionCommand(
  input: AddSuppressionCommand,
): AddSuppressionCommand {
  return AddSuppressionCommandSchema.parse(input);
}
