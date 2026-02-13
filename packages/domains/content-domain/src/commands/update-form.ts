import { z } from 'zod';
import { FormFieldSchema } from '../entities/form.js';

export const UpdateFormCommandSchema = z.object({
  organizationId: z.string().uuid(),
  formId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  fields: z.array(FormFieldSchema).optional(),
  successAction: z.enum(['redirect', 'message']).optional(),
  successUrl: z.string().nullable().optional(),
  successMessage: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFormCommand = z.infer<typeof UpdateFormCommandSchema>;

export function updateFormCommand(input: UpdateFormCommand): UpdateFormCommand {
  return UpdateFormCommandSchema.parse(input);
}
