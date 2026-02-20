import { z } from 'zod';
import {
  AbTestVariantSchema,
  WinnerCriteriaSchema,
} from '../entities/ab-test.js';

export const CreateAbTestCommandSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().min(1),
  variants: z.array(AbTestVariantSchema).min(2),
  winnerCriteria: WinnerCriteriaSchema,
  testPercentage: z.number().min(1).max(100).optional(),
});

export type CreateAbTestCommand = z.infer<typeof CreateAbTestCommandSchema>;

export function createAbTestCommand(
  input: CreateAbTestCommand,
): CreateAbTestCommand {
  return CreateAbTestCommandSchema.parse(input);
}
