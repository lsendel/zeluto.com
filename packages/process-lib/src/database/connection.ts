import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb(poolerUrl?: string) {
  if (!dbInstance) {
    const sql = neon(poolerUrl ?? process.env.DATABASE_POOLER_URL!);
    dbInstance = drizzle(sql);
  }
  return dbInstance;
}
