import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@mauntic/billing-domain/drizzle';

export function createDatabase(connectionString: string): NeonHttpDatabase<typeof schema> {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}
