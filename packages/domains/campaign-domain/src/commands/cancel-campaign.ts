import { z } from 'zod';

export const CancelCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export type CancelCampaignCommand = z.infer<typeof CancelCampaignCommandSchema>;

export function cancelCampaignCommand(
  input: CancelCampaignCommand,
): CancelCampaignCommand {
  return CancelCampaignCommandSchema.parse(input);
}
