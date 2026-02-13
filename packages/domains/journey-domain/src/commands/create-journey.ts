import { z } from 'zod';

export const CreateJourneyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  createdBy: z.string().uuid(),
});

export type CreateJourneyCommand = z.infer<typeof CreateJourneyCommandSchema>;

export function createJourneyCommand(input: CreateJourneyCommand): CreateJourneyCommand {
  return CreateJourneyCommandSchema.parse(input);
}
