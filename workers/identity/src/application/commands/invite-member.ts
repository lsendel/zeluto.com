import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { organizationInvites, organizationMembers, users } from '@mauntic/identity-domain';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const InviteMemberInput = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
  invitedBy: z.string().uuid(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

/**
 * Generate a cryptographically random token for the invite.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function inviteMember(
  db: DrizzleDb,
  input: InviteMemberInput,
  actorRole: string
) {
  const parsed = InviteMemberInput.parse(input);

  // Only owner/admin can invite
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError('Only owners and admins can invite members');
  }

  // Check if user with this email is already a member
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);

  if (existingUser.length > 0) {
    const existingMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, parsed.organizationId),
          eq(organizationMembers.userId, existingUser[0].id)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      throw new AlreadyMemberError(parsed.email);
    }
  }

  // Check for existing pending invite
  const existingInvite = await db
    .select({ id: organizationInvites.id })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, parsed.organizationId),
        eq(organizationInvites.email, parsed.email)
      )
    )
    .limit(1);

  if (existingInvite.length > 0) {
    throw new InviteAlreadyExistsError(parsed.email);
  }

  // Generate token and set 7-day expiry
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId: parsed.organizationId,
      email: parsed.email,
      role: parsed.role,
      token,
      invitedBy: parsed.invitedBy,
      expiresAt,
    })
    .returning();

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
    super(`User with email "${email}" is already a member of this organization`);
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
