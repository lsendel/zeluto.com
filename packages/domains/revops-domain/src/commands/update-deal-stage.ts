import { z } from 'zod';

export const UpdateDealStageCommandSchema = z.object({
  organizationId: z.string().uuid(),
  dealId: z.string().uuid(),
  stage: z.enum([
    'prospecting',
    'qualification',
    'needs_analysis',
    'proposal',
    'negotiation',
    'contract_sent',
    'closed_won',
    'closed_lost',
  ]),
  lostReason: z.string().optional(),
});

export type UpdateDealStageCommand = z.infer<
  typeof UpdateDealStageCommandSchema
>;

export function updateDealStageCommand(
  input: UpdateDealStageCommand,
): UpdateDealStageCommand {
  return UpdateDealStageCommandSchema.parse(input);
}
