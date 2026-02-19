import { z } from 'zod';

export const ListSignalsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  activeOnly: z.boolean().default(true),
});

export type ListSignalsQuery = z.infer<typeof ListSignalsQuerySchema>;

export function listSignalsQuery(input: ListSignalsQuery): ListSignalsQuery {
  return ListSignalsQuerySchema.parse(input);
}
