import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { users, sessions, accounts, verifications, organizations, organizationMembers, organizationInvites } from '@mauntic/identity-domain';
import type { Env, DrizzleDb } from './database.js';

/**
 * Create a per-request Better Auth instance
 * (Cloudflare Workers have no long-lived process, so we create auth instance per request)
 */
export function createAuth(env: Env, db: DrizzleDb) {
  return betterAuth({
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        organization: organizations,
        member: organizationMembers,
        invitation: organizationInvites,
      },
    }),
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    plugins: [organization()],
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
          input: false,
        },
        isBlocked: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
        lastSignedIn: {
          type: 'date',
          required: false,
          input: false,
        },
        loginMethod: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
  });
}
