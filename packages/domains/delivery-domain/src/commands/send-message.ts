import { z } from 'zod';
import { ChannelSchema } from '../entities/delivery-job.js';

export const SendMessageCommandSchema = z.object({
  organizationId: z.string().uuid(),
  channel: ChannelSchema,
  recipient: z.string().min(1), // email/phone/deviceToken/url
  subject: z.string().optional(),
  body: z.string().min(1),
  templateId: z.string().optional(),
  contactId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1),
});

export type SendMessageCommand = z.infer<typeof SendMessageCommandSchema>;

export function sendMessageCommand(input: SendMessageCommand): SendMessageCommand {
  return SendMessageCommandSchema.parse(input);
}
