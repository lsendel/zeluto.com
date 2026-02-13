import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function createDatabase(hyperdrive: Hyperdrive) {
  const client = neon(hyperdrive.connectionString);
  return drizzle(client);
}
