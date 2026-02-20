import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import {
  type InviteRepository,
  type MemberRepository,
  OrganizationInvite,
  type UserRepository,
} from '@mauntic/identity-domain';
import { z } from 'zod';

export const InviteMemberInput = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
  invitedBy: z.string().uuid(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

export async function inviteMember(
  userRepo: UserRepository,
  memberRepo: MemberRepository,
  inviteRepo: InviteRepository,
  input: InviteMemberInput,
  actorRole: string,
) {
  const parsed = InviteMemberInput.parse(input);

  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError(
      'Only owners and admins can invite members',
    );
  }

  // Check if user with this email is already a member
  const existingUser = await userRepo.findByEmail(parsed.email);
  if (existingUser) {
    const membership = await memberRepo.findByOrgAndUser(
      parsed.organizationId as OrganizationId,
      existingUser.id as UserId,
    );
    if (membership) {
      throw new AlreadyMemberError(parsed.email);
    }
  }

  // Check for existing pending invite
  const existingInvites = await inviteRepo.findByOrganization(
    parsed.organizationId as OrganizationId,
  );
  if (existingInvites.some((inv) => inv.email === parsed.email)) {
    throw new InviteAlreadyExistsError(parsed.email);
  }

  const invite = OrganizationInvite.create({
    organizationId: parsed.organizationId,
    email: parsed.email,
    role: parsed.role,
    invitedBy: parsed.invitedBy,
  });
  await inviteRepo.save(invite);
  return invite;
}

export class InsufficientPermissionsError extends Error {
  public readonly code = 'INSUFFICIENT_PERMISSIONS';
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

export class AlreadyMemberError extends Error {
  public readonly code = 'ALREADY_MEMBER';
  constructor(email: string) {
    super(
      `User with email "${email}" is already a member of this organization`,
    );
    this.name = 'AlreadyMemberError';
  }
}

export class InviteAlreadyExistsError extends Error {
  public readonly code = 'INVITE_ALREADY_EXISTS';
  constructor(email: string) {
    super(`An invitation for "${email}" already exists`);
    this.name = 'InviteAlreadyExistsError';
  }
}
