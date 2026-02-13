import { z } from 'zod';

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .transform((v) => v.trim().toLowerCase());

export type Email = z.output<typeof EmailSchema>;

/** Create a validated, normalized email value. */
export function createEmail(raw: string): Email {
  return EmailSchema.parse(raw);
}
