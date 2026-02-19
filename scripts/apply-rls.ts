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

// Tables that don't have org-scoped RLS (don't have organization_id column)
const skipTables = new Set([
  'identity.users',
  'identity.sessions',
  'identity.accounts',
  'identity.verification',
]);

async function applyRLS() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Starting RLS policy application...\n');

  // Get all tables with organization_id column across all schemas
  const result = await sql`
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = ANY($1::text[])
      AND column_name = 'organization_id'
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `, [schemas];

  const tables = result.rows as Array<{
    table_schema: string;
    table_name: string;
  }>;

  if (tables.length === 0) {
    console.log('No tables with organization_id column found.');
    return;
  }

  console.log(`Found ${tables.length} tables with organization_id column:\n`);

  for (const table of tables) {
    const fullTableName = `${table.table_schema}.${table.table_name}`;

    // Skip tables that don't have org-scoped RLS
    if (skipTables.has(fullTableName)) {
      console.log(`⊘ ${fullTableName} (skipped)`);
      continue;
    }

    try {
      // Enable RLS on the table
      await sql`ALTER TABLE ${sql.unsafe(fullTableName)} ENABLE ROW LEVEL SECURITY`;
      console.log(`  ✓ Enabled RLS on ${fullTableName}`);

      // Create the tenant isolation policy (IF NOT EXISTS for idempotency)
      const policyName = `tenant_isolation_${table.table_schema}_${table.table_name}`;
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = ${table.table_name}
              AND schemaname = ${table.table_schema}
              AND policyname = ${policyName}
          ) THEN
            CREATE POLICY ${sql.unsafe(policyName)} ON ${sql.unsafe(fullTableName)}
              USING (organization_id = current_setting('app.organization_id')::uuid);
          END IF;
        END $$
      `;
      console.log(`  ✓ Created RLS policy on ${fullTableName}`);

      // Force RLS (so table owner is also subject to RLS)
      await sql`ALTER TABLE ${sql.unsafe(fullTableName)} FORCE ROW LEVEL SECURITY`;
      console.log(`  ✓ Forced RLS on ${fullTableName}\n`);
    } catch (error) {
      console.error(`  ✗ Error applying RLS to ${fullTableName}:`, error);
      throw error;
    }
  }

  console.log('RLS policies applied successfully!');
}

applyRLS().catch(console.error);
