import { z } from 'zod';

export const UpdateContactCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  email: z.string().email().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateContactCommand = z.infer<typeof UpdateContactCommandSchema>;

export function updateContactCommand(
  input: UpdateContactCommand,
): UpdateContactCommand {
  return UpdateContactCommandSchema.parse(input);
}
