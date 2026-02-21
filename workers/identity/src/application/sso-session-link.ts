import {
  accounts,
  organizationMembers,
  sessions,
  users,
} from '@mauntic/identity-domain';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../infrastructure/database.js';

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export class SsoAccountLinkConflictError extends Error {
  override name = 'SsoAccountLinkConflictError';
}

export class SsoUserBlockedError extends Error {
  override name = 'SsoUserBlockedError';
}

export interface SsoSessionProfile {
  email: string;
  name?: string | null;
  externalId: string;
}

export interface SsoSessionLinkResult {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

export async function completeSsoSessionLink(
  db: DrizzleDb,
  input: {
    organizationId: string;
    connectionId: string;
    profile: SsoSessionProfile;
    ipAddress?: string | null;
    userAgent?: string | null;
    sessionTtlSeconds?: number;
  },
): Promise<SsoSessionLinkResult> {
  const now = new Date();
  const ttlSeconds = input.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = new Date(now.valueOf() + ttlSeconds * 1000);
  const providerId = `sso:${input.connectionId}`;

  const normalizedEmail = input.profile.email.trim().toLowerCase();
  const displayName = input.profile.name?.trim() || null;

  let user = await findUserByEmail(db, normalizedEmail);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: displayName,
        emailVerified: true,
        role: 'member',
        isBlocked: false,
        lastSignedIn: now,
        loginMethod: 'sso',
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isBlocked: users.isBlocked,
      });
  } else {
    if (user.isBlocked) {
      throw new SsoUserBlockedError('User account is blocked');
    }

    [user] = await db
      .update(users)
      .set({
        name: displayName ?? user.name,
        emailVerified: true,
        lastSignedIn: now,
        loginMethod: 'sso',
        updatedAt: now,
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isBlocked: users.isBlocked,
      });
  }

  if (user.isBlocked) {
    throw new SsoUserBlockedError('User account is blocked');
  }

  await ensureOrganizationMembership(db, input.organizationId, user.id);
  await ensureSsoAccountLink(
    db,
    providerId,
    input.profile.externalId,
    user.id,
    now,
  );

  const sessionToken =
    `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
  const [sessionRow] = await db
    .insert(sessions)
    .values({
      id: crypto.randomUUID(),
      token: sessionToken,
      userId: user.id,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      activeOrganizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: sessions.id,
      token: sessions.token,
      expiresAt: sessions.expiresAt,
    });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    },
    session: sessionRow,
  };
}

async function findUserByEmail(db: DrizzleDb, email: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isBlocked: users.isBlocked,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

async function ensureOrganizationMembership(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
) {
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    await db.insert(organizationMembers).values({
      organizationId,
      userId,
      role: 'member',
      joinedAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function ensureSsoAccountLink(
  db: DrizzleDb,
  providerId: string,
  externalId: string,
  userId: string,
  now: Date,
) {
  const [existingLink] = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.providerId, providerId),
        eq(accounts.accountId, externalId),
      ),
    )
    .limit(1);

  if (existingLink && existingLink.userId !== userId) {
    throw new SsoAccountLinkConflictError(
      'SSO account is linked to another user',
    );
  }

  if (!existingLink) {
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: externalId,
      providerId,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(accounts)
      .set({
        updatedAt: now,
      })
      .where(eq(accounts.id, existingLink.id));
  }
}
