import { z } from 'zod';

export const PublishJourneyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  journeyId: z.string().uuid(),
  publishedBy: z.string().uuid(),
});

export type PublishJourneyCommand = z.infer<typeof PublishJourneyCommandSchema>;

export function publishJourneyCommand(input: PublishJourneyCommand): PublishJourneyCommand {
  return PublishJourneyCommandSchema.parse(input);
}
