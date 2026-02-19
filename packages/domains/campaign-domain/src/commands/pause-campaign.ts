import { z } from 'zod';

export const PauseCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  pausedBy: z.string().uuid(),
});

export type PauseCampaignCommand = z.infer<typeof PauseCampaignCommandSchema>;

export function pauseCampaignCommand(input: PauseCampaignCommand): PauseCampaignCommand {
  return PauseCampaignCommandSchema.parse(input);
}
