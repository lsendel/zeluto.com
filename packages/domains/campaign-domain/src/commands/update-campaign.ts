import { z } from 'zod';

export const UpdateCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  segmentId: z.string().uuid().nullable().optional(),
});

export type UpdateCampaignCommand = z.infer<typeof UpdateCampaignCommandSchema>;

export function updateCampaignCommand(input: UpdateCampaignCommand): UpdateCampaignCommand {
  return UpdateCampaignCommandSchema.parse(input);
}
