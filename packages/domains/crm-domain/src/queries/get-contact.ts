import { z } from 'zod';

export const GetContactQuerySchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type GetContactQuery = z.infer<typeof GetContactQuerySchema>;

export function getContactQuery(input: GetContactQuery): GetContactQuery {
  return GetContactQuerySchema.parse(input);
}
