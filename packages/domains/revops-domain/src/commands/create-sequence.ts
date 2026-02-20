import { z } from 'zod';

export const CreateSequenceCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string(),
  steps: z
    .array(
      z.object({
        type: z.enum([
          'email',
          'linkedin_connect',
          'linkedin_message',
          'sms',
          'phone_call',
          'wait',
        ]),
        delayDays: z.number().int().min(0),
        templateId: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
      }),
    )
    .optional(),
  dailyLimits: z
    .object({
      email: z.number().int().min(0).default(100),
      linkedin: z.number().int().min(0).default(50),
      sms: z.number().int().min(0).default(25),
    })
    .optional(),
  createdBy: z.string().uuid().optional(),
});

export type CreateSequenceCommand = z.infer<typeof CreateSequenceCommandSchema>;

export function createSequenceCommand(
  input: CreateSequenceCommand,
): CreateSequenceCommand {
  return CreateSequenceCommandSchema.parse(input);
}
