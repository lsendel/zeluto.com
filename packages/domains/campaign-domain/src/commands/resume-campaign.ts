import { z } from 'zod';

export const ResumeCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
});

export type ResumeCampaignCommand = z.infer<typeof ResumeCampaignCommandSchema>;

export function resumeCampaignCommand(
  input: ResumeCampaignCommand,
): ResumeCampaignCommand {
  return ResumeCampaignCommandSchema.parse(input);
}
