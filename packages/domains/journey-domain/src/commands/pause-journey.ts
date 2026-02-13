import { z } from 'zod';

export const PauseJourneyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  journeyId: z.string().uuid(),
  pausedBy: z.string().uuid(),
});

export type PauseJourneyCommand = z.infer<typeof PauseJourneyCommandSchema>;

export function pauseJourneyCommand(input: PauseJourneyCommand): PauseJourneyCommand {
  return PauseJourneyCommandSchema.parse(input);
}
