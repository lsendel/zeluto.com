import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '@mauntic/identity-domain';

export interface Env {
  DB: Hyperdrive;
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
 * Create a Drizzle database connection using Hyperdrive
 */
export function createDatabase(env: Env) {
  // Configure Neon for Cloudflare Workers
  neonConfig.fetchConnectionCache = true;

  const pool = new Pool({ connectionString: env.DB.connectionString });

  return drizzle(pool, { schema });
}

export type DrizzleDb = ReturnType<typeof createDatabase>;
