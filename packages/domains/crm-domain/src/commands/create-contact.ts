import { z } from 'zod';

export const CreateContactCommandSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateContactCommand = z.infer<typeof CreateContactCommandSchema>;

export function createContactCommand(
  input: CreateContactCommand,
): CreateContactCommand {
  return CreateContactCommandSchema.parse(input);
}
