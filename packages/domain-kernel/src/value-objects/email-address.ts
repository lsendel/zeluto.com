import { z } from 'zod';

export const EmailAddressSchema = z.string().email();
export type EmailAddress = z.infer<typeof EmailAddressSchema>;

export function createEmailAddress(value: string): EmailAddress {
  return EmailAddressSchema.parse(value);
}
