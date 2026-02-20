import { z } from 'zod';

export const MergeContactsCommandSchema = z.object({
  organizationId: z.string().uuid(),
  /** The primary contact that will absorb the secondary's data and keep its ID. */
  primaryContactId: z.string().uuid(),
  /** The secondary contact whose data will be merged into the primary. */
  secondaryContactId: z.string().uuid(),
});

export type MergeContactsCommand = z.infer<typeof MergeContactsCommandSchema>;

export function mergeContactsCommand(
  input: MergeContactsCommand,
): MergeContactsCommand {
  return MergeContactsCommandSchema.parse(input);
}
