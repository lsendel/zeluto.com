import { neon } from '@neondatabase/serverless';

const schemas = [
  'identity',
  'billing',
  'crm',
  'journey',
  'campaign',
  'delivery',
  'content',
  'analytics',
  'integrations',
  'lead_intelligence',
  'scoring',
  'revops',
];

async function initSchemas() {
  const sql = neon(process.env.DATABASE_URL!);

  for (const schema of schemas) {
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql.unsafe(schema)}`;
    console.log(`Created schema: ${schema}`);
  }

  console.log('All schemas created. Run migrations next, then apply RLS.');
}

initSchemas().catch(console.error);
