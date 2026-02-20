import { z } from 'zod';

export const CreateLandingPageCommandSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  htmlContent: z.string().optional(),
  metaDescription: z.string().optional(),
  templateId: z.string().uuid().optional(),
});

export type CreateLandingPageCommand = z.infer<
  typeof CreateLandingPageCommandSchema
>;

export function createLandingPageCommand(
  input: CreateLandingPageCommand,
): CreateLandingPageCommand {
  return CreateLandingPageCommandSchema.parse(input);
}
