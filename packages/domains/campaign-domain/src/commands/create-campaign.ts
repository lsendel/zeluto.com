import { z } from 'zod';
import { CampaignTypeSchema } from '../entities/campaign.js';

export const CreateCampaignCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: CampaignTypeSchema,
  subject: z.string().optional(),
  templateId: z.string().uuid().optional(),
  segmentId: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
});

export type CreateCampaignCommand = z.infer<typeof CreateCampaignCommandSchema>;

export function createCampaignCommand(
  input: CreateCampaignCommand,
): CreateCampaignCommand {
  return CreateCampaignCommandSchema.parse(input);
}
