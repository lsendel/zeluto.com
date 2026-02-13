import { z } from 'zod';

export const SelectAbTestWinnerCommandSchema = z.object({
  organizationId: z.string().uuid(),
  testId: z.string().uuid(),
  winnerVariantId: z.string(),
});

export type SelectAbTestWinnerCommand = z.infer<typeof SelectAbTestWinnerCommandSchema>;

export function selectAbTestWinnerCommand(
  input: SelectAbTestWinnerCommand,
): SelectAbTestWinnerCommand {
  return SelectAbTestWinnerCommandSchema.parse(input);
}
