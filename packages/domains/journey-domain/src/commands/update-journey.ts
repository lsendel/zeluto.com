import { z } from 'zod';

export const UpdateJourneyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  journeyId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export type UpdateJourneyCommand = z.infer<typeof UpdateJourneyCommandSchema>;

export function updateJourneyCommand(input: UpdateJourneyCommand): UpdateJourneyCommand {
  return UpdateJourneyCommandSchema.parse(input);
}
