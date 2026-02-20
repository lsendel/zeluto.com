import type { OrganizationId } from '@mauntic/domain-kernel';
import type { OrganizationRepository } from '@mauntic/identity-domain';
import { z } from 'zod';

export const UpdateOrgInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  logo: z.string().nullable().optional(),
});

export type UpdateOrgInput = z.infer<typeof UpdateOrgInput>;

export async function updateOrg(
  orgRepo: OrganizationRepository,
  input: UpdateOrgInput,
  _actorUserId: string,
  actorRole: string,
) {
  const parsed = UpdateOrgInput.parse(input);

  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError(
      'Only owners and admins can update the organization',
    );
  }

  const org = await orgRepo.findById(parsed.organizationId as OrganizationId);
  if (!org) {
    throw new OrgNotFoundError(parsed.organizationId);
  }

  org.update({
    name: parsed.name,
    logo: parsed.logo,
  });
  await orgRepo.save(org);
  return org;
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
