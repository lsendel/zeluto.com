import { z } from 'zod';

export const UpdateLandingPageCommandSchema = z.object({
  organizationId: z.string().uuid(),
  pageId: z.string().uuid(),
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  htmlContent: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
});

export type UpdateLandingPageCommand = z.infer<typeof UpdateLandingPageCommandSchema>;

export function updateLandingPageCommand(input: UpdateLandingPageCommand): UpdateLandingPageCommand {
  return UpdateLandingPageCommandSchema.parse(input);
}
