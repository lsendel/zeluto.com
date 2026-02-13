import { z } from 'zod';

export const TrackingEventTypeSchema = z.enum([
  'open',
  'click',
  'bounce',
  'complaint',
  'unsubscribe',
]);

export const ProcessTrackingEventCommandSchema = z.object({
  organizationId: z.string().uuid(),
  type: TrackingEventTypeSchema,
  externalId: z.string().min(1),
  contactId: z.string().optional(),
  timestamp: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type ProcessTrackingEventCommand = z.infer<typeof ProcessTrackingEventCommandSchema>;

export function processTrackingEventCommand(input: ProcessTrackingEventCommand): ProcessTrackingEventCommand {
  return ProcessTrackingEventCommandSchema.parse(input);
}
