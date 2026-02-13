import { z } from 'zod';

/**
 * Slug value object.
 * Lowercase alphanumeric characters and hyphens only.
 * No leading/trailing hyphens, no consecutive hyphens.
 * Minimum 2 characters, maximum 100 characters.
 */
export const SlugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens',
  )
  .refine((v) => !v.includes('--'), 'Slug must not contain consecutive hyphens');

export type Slug = z.output<typeof SlugSchema>;

/** Create a validated slug value. */
export function createSlug(raw: string): Slug {
  return SlugSchema.parse(raw);
}
