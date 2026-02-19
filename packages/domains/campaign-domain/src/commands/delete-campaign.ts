import { z } from 'zod';

export const DeleteCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export type DeleteCampaignCommand = z.infer<typeof DeleteCampaignCommandSchema>;

export function deleteCampaignCommand(input: DeleteCampaignCommand): DeleteCampaignCommand {
  return DeleteCampaignCommandSchema.parse(input);
}
