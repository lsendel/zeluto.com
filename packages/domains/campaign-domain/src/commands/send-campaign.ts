import { z } from 'zod';

export const SendCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export type SendCampaignCommand = z.infer<typeof SendCampaignCommandSchema>;

export function sendCampaignCommand(input: SendCampaignCommand): SendCampaignCommand {
  return SendCampaignCommandSchema.parse(input);
}
