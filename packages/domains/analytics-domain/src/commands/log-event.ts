import { z } from 'zod';

export const LogEventCommandSchema = z.object({
  organizationId: z.string().uuid(),
  eventType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string(),
  contactId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogEventCommand = z.infer<typeof LogEventCommandSchema>;

export function logEventCommand(input: LogEventCommand): LogEventCommand {
  return LogEventCommandSchema.parse(input);
}
