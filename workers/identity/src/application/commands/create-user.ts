import { organizationMembers, users } from '@mauntic/identity-domain';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DrizzleDb } from '../../infrastructure/database.js';

export const CreateUserInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
  organizationId: z.string().uuid(),
  invitedBy: z.string().uuid(),
  memberRole: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export type CreateUserInput = z.infer<typeof CreateUserInput>;

export interface CreateUserResult {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  isBlocked: boolean | null;
  lastSignedIn: Date | null;
  loginMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createUser(
  db: DrizzleDb,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const parsed = CreateUserInput.parse(input);

  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);

  if (existing) {
    throw new UserAlreadyExistsError(parsed.email);
  }

  // Insert user
  const [created] = await db
    .insert(users)
    .values({
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
    })
    .returning();

  // Add user as member of the organization
  await db.insert(organizationMembers).values({
    organizationId: parsed.organizationId,
    userId: created.id,
    role: parsed.memberRole,
    invitedBy: parsed.invitedBy,
  });

  return created;
}

export class UserAlreadyExistsError extends Error {
  public readonly code = 'USER_ALREADY_EXISTS';
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
    this.name = 'UserAlreadyExistsError';
  }
}
