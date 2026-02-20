import { organizations } from '@mauntic/identity-domain';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const CreateOrgInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  creatorUserId: z.string().uuid(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgInput>;

/**
 * Generate a URL-safe slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Ensure a slug is unique by appending a random suffix if needed.
 */
async function ensureUniqueSlug(
  db: DrizzleDb,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 10) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!existing) {
      return slug;
    }

    // Append random suffix
    const suffix = Math.random().toString(36).slice(2, 6);
    slug = `${baseSlug}-${suffix}`;
    attempt++;
  }

  // Fallback: use UUID fragment
  const uuidFragment = crypto.randomUUID().slice(0, 8);
  return `${baseSlug}-${uuidFragment}`;
}

export async function createOrg(db: DrizzleDb, input: CreateOrgInput) {
  const parsed = CreateOrgInput.parse(input);

  const baseSlug = parsed.slug
    ? generateSlug(parsed.slug)
    : generateSlug(parsed.name);
  const slug = await ensureUniqueSlug(db, baseSlug);

  const [org] = await db
    .insert(organizations)
    .values({
      name: parsed.name,
      slug,
    })
    .returning();

  // Insert membership while setting the RLS context within the same statement
  await db.execute(sql`
    WITH __ctx AS (
      SELECT set_config('app.organization_id', ${org.id}::text, true)
    )
    INSERT INTO "identity"."organization_members" (organization_id, user_id, role)
    VALUES (${org.id}, ${parsed.creatorUserId}, 'owner')
  `);

  return org;
}
