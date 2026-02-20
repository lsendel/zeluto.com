import { organizations } from '@mauntic/identity-domain';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const UpdateOrgInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  logo: z.string().nullable().optional(),
});

export type UpdateOrgInput = z.infer<typeof UpdateOrgInput>;

export async function updateOrg(
  db: DrizzleDb,
  input: UpdateOrgInput,
  _actorUserId: string,
  actorRole: string,
) {
  const parsed = UpdateOrgInput.parse(input);

  // Only owner or admin can update organization
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError(
      'Only owners and admins can update the organization',
    );
  }

  // Check organization exists
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, parsed.organizationId))
    .limit(1);

  if (!existing) {
    throw new OrgNotFoundError(parsed.organizationId);
  }

  // Build update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.name !== undefined) {
    updateValues.name = parsed.name;
  }
  if (parsed.slug !== undefined) {
    updateValues.slug = parsed.slug;
  }
  if (parsed.logo !== undefined) {
    updateValues.logo = parsed.logo;
  }

  const [updated] = await db
    .update(organizations)
    .set(updateValues)
    .where(eq(organizations.id, parsed.organizationId))
    .returning();

  return updated;
}

export class OrgNotFoundError extends Error {
  public readonly code = 'ORG_NOT_FOUND';
  constructor(id: string) {
    super(`Organization with ID "${id}" not found`);
    this.name = 'OrgNotFoundError';
  }
}

export class InsufficientPermissionsError extends Error {
  public readonly code = 'INSUFFICIENT_PERMISSIONS';
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}
