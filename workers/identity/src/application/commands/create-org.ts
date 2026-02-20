import type { OrganizationRepository } from '@mauntic/identity-domain';
import { organizations } from '@mauntic/identity-domain';
import { sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { z } from 'zod';

export const CreateOrgInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  creatorUserId: z.string().uuid(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgInput>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

async function ensureUniqueSlug(
  orgRepo: OrganizationRepository,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 10) {
    const existing = await orgRepo.findBySlug(slug);
    if (!existing) {
      return slug;
    }

    const suffix = Math.random().toString(36).slice(2, 6);
    slug = `${baseSlug}-${suffix}`;
    attempt++;
  }

  const uuidFragment = crypto.randomUUID().slice(0, 8);
  return `${baseSlug}-${uuidFragment}`;
}

/**
 * Creates an organization with the creator as owner.
 * Uses a transaction with set_config for RLS context, so requires raw db access.
 */
export async function createOrg(
  db: NeonHttpDatabase<any>,
  orgRepo: OrganizationRepository,
  input: CreateOrgInput,
) {
  const parsed = CreateOrgInput.parse(input);

  const baseSlug = parsed.slug
    ? generateSlug(parsed.slug)
    : generateSlug(parsed.name);
  const slug = await ensureUniqueSlug(orgRepo, baseSlug);

  // Transaction with raw SQL needed for set_config('app.organization_id', ...) RLS context
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: parsed.name,
        slug,
      })
      .returning();

    await tx.execute(sql`
      WITH __ctx AS (
        SELECT set_config('app.organization_id', ${org.id}::text, true)
      )
      INSERT INTO "identity"."organization_members" (organization_id, user_id, role)
      VALUES (${org.id}, ${parsed.creatorUserId}, 'owner')
    `);

    return org;
  });
}
