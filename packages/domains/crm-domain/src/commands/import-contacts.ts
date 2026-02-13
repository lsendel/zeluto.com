import { z } from 'zod';

export const ImportContactRowSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type ImportContactRow = z.infer<typeof ImportContactRowSchema>;

export const ImportContactsCommandSchema = z.object({
  organizationId: z.string().uuid(),
  /** Batch of contact records to import. */
  contacts: z.array(ImportContactRowSchema).min(1),
});

export type ImportContactsCommand = z.infer<typeof ImportContactsCommandSchema>;

export function importContactsCommand(input: ImportContactsCommand): ImportContactsCommand {
  return ImportContactsCommandSchema.parse(input);
}
