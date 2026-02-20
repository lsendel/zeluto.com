import type { UserRole } from '@mauntic/identity-domain';
import {
  type MemberRepository,
  OrganizationMember,
  User,
  type UserRepository,
} from '@mauntic/identity-domain';
import { z } from 'zod';

export const CreateUserInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
  organizationId: z.string().uuid(),
  invitedBy: z.string().uuid(),
  memberRole: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export type CreateUserInput = z.infer<typeof CreateUserInput>;

export async function createUser(
  userRepo: UserRepository,
  memberRepo: MemberRepository,
  input: CreateUserInput,
) {
  const parsed = CreateUserInput.parse(input);

  // Check for duplicate email
  const existing = await userRepo.findByEmail(parsed.email);
  if (existing) {
    throw new UserAlreadyExistsError(parsed.email);
  }

  const user = User.create({
    email: parsed.email,
    name: parsed.name,
    role: parsed.role as UserRole,
  });
  await userRepo.save(user);

  const member = OrganizationMember.create({
    organizationId: parsed.organizationId,
    userId: user.id,
    role: parsed.memberRole as UserRole,
    invitedBy: parsed.invitedBy,
  });
  await memberRepo.save(member);

  return user;
}

export class UserAlreadyExistsError extends Error {
  public readonly code = 'USER_ALREADY_EXISTS';
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
    this.name = 'UserAlreadyExistsError';
  }
}
