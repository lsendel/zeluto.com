import { z } from 'zod';

export const RecalculateScoresCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

export type RecalculateScoresCommand = z.infer<
  typeof RecalculateScoresCommandSchema
>;

export function recalculateScoresCommand(
  input: RecalculateScoresCommand,
): RecalculateScoresCommand {
  return RecalculateScoresCommandSchema.parse(input);
}
