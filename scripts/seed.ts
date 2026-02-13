import { neon } from '@neondatabase/serverless';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Seeding database...');

  // TODO: Create demo organization
  // TODO: Create admin user
  // TODO: Create sample contacts
  // TODO: Create sample journey

  console.log('Seeding complete (stub - implement after schemas exist).');
}

seed().catch(console.error);
