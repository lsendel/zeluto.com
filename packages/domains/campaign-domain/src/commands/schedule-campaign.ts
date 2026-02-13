import { z } from 'zod';

export const ScheduleCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
});

export type ScheduleCampaignCommand = z.infer<typeof ScheduleCampaignCommandSchema>;

export function scheduleCampaignCommand(input: ScheduleCampaignCommand): ScheduleCampaignCommand {
  return ScheduleCampaignCommandSchema.parse(input);
}
