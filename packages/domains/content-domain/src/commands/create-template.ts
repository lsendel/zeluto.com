import { z } from 'zod';

export const CreateTemplateCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['email', 'sms', 'push', 'page']),
  category: z.string().optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  bodyJson: z.record(z.string(), z.unknown()).optional(),
  thumbnailUrl: z.string().optional(),
  createdBy: z.string().uuid(),
});

export type CreateTemplateCommand = z.infer<typeof CreateTemplateCommandSchema>;

export function createTemplateCommand(input: CreateTemplateCommand): CreateTemplateCommand {
  return CreateTemplateCommandSchema.parse(input);
}
