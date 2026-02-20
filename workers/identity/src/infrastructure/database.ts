import * as schema from '@mauntic/identity-domain';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export interface Env {
  DB: Hyperdrive;
  DATABASE_URL: string;
  KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  APP_DOMAIN: string;
}

/**
 * Create a Drizzle database connection using Neon HTTP driver directly
 */
export function createDatabase(env: Env) {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type DrizzleDb = ReturnType<typeof createDatabase>;
