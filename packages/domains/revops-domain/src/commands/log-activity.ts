import { z } from 'zod';

export const LogActivityCommandSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(['call', 'email', 'meeting', 'demo', 'task', 'note', 'linkedin', 'sms']),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  outcome: z.string().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().optional(),
  createdBy: z.string().uuid().optional(),
});

export type LogActivityCommand = z.infer<typeof LogActivityCommandSchema>;

export function logActivityCommand(input: LogActivityCommand): LogActivityCommand {
  return LogActivityCommandSchema.parse(input);
}
