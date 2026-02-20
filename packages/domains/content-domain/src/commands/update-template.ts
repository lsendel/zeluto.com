import { z } from 'zod';

export const UpdateTemplateCommandSchema = z.object({
  organizationId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  bodyHtml: z.string().nullable().optional(),
  bodyText: z.string().nullable().optional(),
  bodyJson: z.record(z.string(), z.unknown()).nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTemplateCommand = z.infer<typeof UpdateTemplateCommandSchema>;

export function updateTemplateCommand(
  input: UpdateTemplateCommand,
): UpdateTemplateCommand {
  return UpdateTemplateCommandSchema.parse(input);
}
