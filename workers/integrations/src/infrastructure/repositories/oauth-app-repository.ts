import {
  oauthApps,
  oauthGrants,
} from '@mauntic/integrations-domain/drizzle';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type OAuthAppRow = typeof oauthApps.$inferSelect;
export type OAuthGrantRow = typeof oauthGrants.$inferSelect;

// ── OAuth Apps ──────────────────────────────────────────

export async function findOAuthAppById(
  db: NeonHttpDatabase,
  id: string,
): Promise<OAuthAppRow | null> {
  const [row] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.id, id));
  return row ?? null;
}

export async function findOAuthAppByClientId(
  db: NeonHttpDatabase,
  clientId: string,
): Promise<OAuthAppRow | null> {
  const [row] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId));
  return row ?? null;
}

export async function findOAuthAppsByOrg(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number },
): Promise<{ data: OAuthAppRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = eq(oauthApps.organizationId, orgId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(oauthApps)
      .where(where)
      .orderBy(desc(oauthApps.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(oauthApps)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function findPublishedApps(
  db: NeonHttpDatabase,
  opts: { page: number; limit: number },
): Promise<{ data: OAuthAppRow[]; total: number }> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const where = eq(oauthApps.isPublished, true);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(oauthApps)
      .where(where)
      .orderBy(desc(oauthApps.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(oauthApps)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function insertOAuthApp(
  db: NeonHttpDatabase,
  data: typeof oauthApps.$inferInsert,
): Promise<OAuthAppRow> {
  const [row] = await db.insert(oauthApps).values(data).returning();
  return row;
}

export async function updateOAuthApp(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    logoUrl: string | null;
    redirectUris: unknown;
    scopes: unknown;
    isPublished: boolean;
    isVerified: boolean;
    clientSecret: string;
  }>,
): Promise<OAuthAppRow | null> {
  const [row] = await db
    .update(oauthApps)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(oauthApps.id, id), eq(oauthApps.organizationId, orgId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteOAuthApp(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(oauthApps)
    .where(
      and(eq(oauthApps.id, id), eq(oauthApps.organizationId, orgId)),
    )
    .returning({ id: oauthApps.id });
  return result.length > 0;
}

// ── OAuth Grants ────────────────────────────────────────

export async function findGrantByCode(
  db: NeonHttpDatabase,
  code: string,
): Promise<OAuthGrantRow | null> {
  const [row] = await db
    .select()
    .from(oauthGrants)
    .where(and(eq(oauthGrants.code, code), isNull(oauthGrants.revokedAt)));
  return row ?? null;
}

export async function findGrantByAccessToken(
  db: NeonHttpDatabase,
  token: string,
): Promise<OAuthGrantRow | null> {
  const [row] = await db
    .select()
    .from(oauthGrants)
    .where(
      and(eq(oauthGrants.accessToken, token), isNull(oauthGrants.revokedAt)),
    );
  return row ?? null;
}

export async function findGrantByRefreshToken(
  db: NeonHttpDatabase,
  token: string,
): Promise<OAuthGrantRow | null> {
  const [row] = await db
    .select()
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.refreshToken, token),
        isNull(oauthGrants.revokedAt),
      ),
    );
  return row ?? null;
}

export async function findGrantsByOrg(
  db: NeonHttpDatabase,
  orgId: string,
  appId: string,
): Promise<OAuthGrantRow[]> {
  return db
    .select()
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.organizationId, orgId),
        eq(oauthGrants.appId, appId),
        isNull(oauthGrants.revokedAt),
      ),
    )
    .orderBy(desc(oauthGrants.createdAt));
}

export async function insertGrant(
  db: NeonHttpDatabase,
  data: typeof oauthGrants.$inferInsert,
): Promise<OAuthGrantRow> {
  const [row] = await db.insert(oauthGrants).values(data).returning();
  return row;
}

export async function updateGrant(
  db: NeonHttpDatabase,
  id: string,
  data: Partial<{
    code: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    revokedAt: Date | null;
  }>,
): Promise<OAuthGrantRow | null> {
  const [row] = await db
    .update(oauthGrants)
    .set(data)
    .where(eq(oauthGrants.id, id))
    .returning();
  return row ?? null;
}

export async function revokeGrantsByApp(
  db: NeonHttpDatabase,
  orgId: string,
  appId: string,
): Promise<number> {
  const result = await db
    .update(oauthGrants)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthGrants.organizationId, orgId),
        eq(oauthGrants.appId, appId),
        isNull(oauthGrants.revokedAt),
      ),
    )
    .returning({ id: oauthGrants.id });
  return result.length;
}
