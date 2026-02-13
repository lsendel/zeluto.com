import { z } from 'zod';
import { FormFieldSchema } from '../entities/form.js';

export const CreateFormCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema),
  successAction: z.enum(['redirect', 'message']).optional(),
  successUrl: z.string().optional(),
  successMessage: z.string().optional(),
});

export type CreateFormCommand = z.infer<typeof CreateFormCommandSchema>;

export function createFormCommand(input: CreateFormCommand): CreateFormCommand {
  return CreateFormCommandSchema.parse(input);
}
