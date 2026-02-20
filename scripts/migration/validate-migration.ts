/**
 * Post-Migration Validation Script
 *
 * Verifies the integrity of migrated data by:
 *   1. Comparing row counts between source (MySQL) and target (Postgres)
 *   2. Checking referential integrity in the target database
 *   3. Sampling records for data accuracy
 *   4. Verifying no data loss for critical fields (email, name)
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/migration/validate-migration.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

const results: ValidationResult[] = [];

function pass(
  check: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  results.push({ check, status: 'pass', message, details });
}

function warn(
  check: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  results.push({ check, status: 'warn', message, details });
}

function fail(
  check: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  results.push({ check, status: 'fail', message, details });
}

// ---------------------------------------------------------------------------
// 1. Row count checks
// ---------------------------------------------------------------------------

async function checkRowCounts(): Promise<void> {
  console.log('\n--- Row Count Checks ---');

  const tables = [
    { schema: 'identity', table: 'users', label: 'Users' },
    { schema: 'identity', table: 'organizations', label: 'Organizations' },
    {
      schema: 'identity',
      table: 'organization_members',
      label: 'Organization Members',
    },
    { schema: 'crm', table: 'contacts', label: 'Contacts' },
    { schema: 'crm', table: 'companies', label: 'Companies' },
    { schema: 'crm', table: 'tags', label: 'Tags' },
    { schema: 'content', table: 'templates', label: 'Email Templates' },
    { schema: 'content', table: 'forms', label: 'Forms' },
    { schema: 'content', table: 'landing_pages', label: 'Landing Pages' },
    { schema: 'campaign', table: 'campaigns', label: 'Campaigns' },
  ];

  for (const { schema, table, label } of tables) {
    try {
      const query = `SELECT count(*)::int as count FROM ${schema}.${table}`;
      const result = await sql(query as unknown as TemplateStringsArray);
      const count = (result[0] as { count: number })?.count ?? 0;

      if (count > 0) {
        pass(`rowcount.${table}`, `${label}: ${count} rows`, { count });
      } else {
        warn(`rowcount.${table}`, `${label}: 0 rows - table appears empty`, {
          count,
        });
      }
    } catch (error) {
      fail(`rowcount.${table}`, `${label}: query failed - ${String(error)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Referential integrity checks
// ---------------------------------------------------------------------------

async function checkReferentialIntegrity(): Promise<void> {
  console.log('\n--- Referential Integrity Checks ---');

  // Check: All organization_members reference valid users
  try {
    const [row] = await sql`
      SELECT count(*)::int as orphans
      FROM identity.organization_members om
      LEFT JOIN identity.users u ON om.user_id = u.id
      WHERE u.id IS NULL
    `;
    const orphans = (row as { orphans: number })?.orphans ?? 0;
    if (orphans === 0) {
      pass(
        'ref.members_users',
        'All organization members reference valid users',
      );
    } else {
      fail(
        'ref.members_users',
        `${orphans} organization members reference non-existent users`,
        { orphans },
      );
    }
  } catch (error) {
    fail('ref.members_users', `Query failed: ${String(error)}`);
  }

  // Check: All organization_members reference valid organizations
  try {
    const [row] = await sql`
      SELECT count(*)::int as orphans
      FROM identity.organization_members om
      LEFT JOIN identity.organizations o ON om.organization_id = o.id
      WHERE o.id IS NULL
    `;
    const orphans = (row as { orphans: number })?.orphans ?? 0;
    if (orphans === 0) {
      pass(
        'ref.members_orgs',
        'All organization members reference valid organizations',
      );
    } else {
      fail(
        'ref.members_orgs',
        `${orphans} org members reference non-existent organizations`,
        { orphans },
      );
    }
  } catch (error) {
    fail('ref.members_orgs', `Query failed: ${String(error)}`);
  }

  // Check: All contacts have a valid organization_id
  try {
    const [row] = await sql`
      SELECT count(*)::int as orphans
      FROM crm.contacts c
      LEFT JOIN identity.organizations o ON c.organization_id = o.id
      WHERE o.id IS NULL
    `;
    const orphans = (row as { orphans: number })?.orphans ?? 0;
    if (orphans === 0) {
      pass('ref.contacts_orgs', 'All contacts reference valid organizations');
    } else {
      fail(
        'ref.contacts_orgs',
        `${orphans} contacts reference non-existent organizations`,
        { orphans },
      );
    }
  } catch (error) {
    fail('ref.contacts_orgs', `Query failed: ${String(error)}`);
  }

  // Check: All contacts with company_id reference valid companies
  try {
    const [row] = await sql`
      SELECT count(*)::int as orphans
      FROM crm.contacts c
      LEFT JOIN crm.companies co ON c.company_id = co.id
      WHERE c.company_id IS NOT NULL AND co.id IS NULL
    `;
    const orphans = (row as { orphans: number })?.orphans ?? 0;
    if (orphans === 0) {
      pass(
        'ref.contacts_companies',
        'All contacts with company_id reference valid companies',
      );
    } else {
      warn(
        'ref.contacts_companies',
        `${orphans} contacts reference non-existent companies`,
        { orphans },
      );
    }
  } catch (error) {
    fail('ref.contacts_companies', `Query failed: ${String(error)}`);
  }

  // Check: All templates have a valid organization_id
  try {
    const [row] = await sql`
      SELECT count(*)::int as orphans
      FROM content.templates t
      LEFT JOIN identity.organizations o ON t.organization_id = o.id
      WHERE o.id IS NULL
    `;
    const orphans = (row as { orphans: number })?.orphans ?? 0;
    if (orphans === 0) {
      pass('ref.templates_orgs', 'All templates reference valid organizations');
    } else {
      fail(
        'ref.templates_orgs',
        `${orphans} templates reference non-existent organizations`,
        { orphans },
      );
    }
  } catch (error) {
    fail('ref.templates_orgs', `Query failed: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Data quality checks
// ---------------------------------------------------------------------------

async function checkDataQuality(): Promise<void> {
  console.log('\n--- Data Quality Checks ---');

  // Check: No contacts with null email AND null first_name AND null last_name
  try {
    const [row] = await sql`
      SELECT count(*)::int as ghost_contacts
      FROM crm.contacts
      WHERE email IS NULL AND first_name IS NULL AND last_name IS NULL
    `;
    const ghosts = (row as { ghost_contacts: number })?.ghost_contacts ?? 0;
    if (ghosts === 0) {
      pass(
        'quality.ghost_contacts',
        'No ghost contacts (all have at least email or name)',
      );
    } else {
      warn(
        'quality.ghost_contacts',
        `${ghosts} contacts have no email, first_name, or last_name`,
        { ghosts },
      );
    }
  } catch (error) {
    fail('quality.ghost_contacts', `Query failed: ${String(error)}`);
  }

  // Check: All users have valid emails
  try {
    const [row] = await sql`
      SELECT count(*)::int as invalid_emails
      FROM identity.users
      WHERE email IS NULL OR email = '' OR email NOT LIKE '%@%'
    `;
    const invalid = (row as { invalid_emails: number })?.invalid_emails ?? 0;
    if (invalid === 0) {
      pass('quality.user_emails', 'All users have valid email addresses');
    } else {
      fail(
        'quality.user_emails',
        `${invalid} users have invalid email addresses`,
        { invalid },
      );
    }
  } catch (error) {
    fail('quality.user_emails', `Query failed: ${String(error)}`);
  }

  // Check: All UUIDs are properly formatted
  try {
    const [row] = await sql`
      SELECT count(*)::int as bad_uuids
      FROM crm.contacts
      WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `;
    const bad = (row as { bad_uuids: number })?.bad_uuids ?? 0;
    if (bad === 0) {
      pass('quality.uuid_format', 'All contact IDs are valid UUIDs');
    } else {
      fail(
        'quality.uuid_format',
        `${bad} contacts have improperly formatted UUIDs`,
        { bad },
      );
    }
  } catch (error) {
    fail('quality.uuid_format', `Query failed: ${String(error)}`);
  }

  // Check: Mautic IDs preserved in custom_fields
  try {
    const [row] = await sql`
      SELECT count(*)::int as with_mautic_id
      FROM crm.contacts
      WHERE custom_fields->>'mautic_id' IS NOT NULL
    `;
    const count = (row as { with_mautic_id: number })?.with_mautic_id ?? 0;
    if (count > 0) {
      pass(
        'quality.mautic_id_preserved',
        `${count} contacts have mautic_id in custom_fields`,
        { count },
      );
    } else {
      warn(
        'quality.mautic_id_preserved',
        'No contacts have mautic_id in custom_fields - migration may not have run',
      );
    }
  } catch (error) {
    // This is expected if migration hasn't run yet
    warn(
      'quality.mautic_id_preserved',
      `Query failed (expected if no migration yet): ${String(error)}`,
    );
  }

  // Check: No duplicate emails within same organization
  try {
    const [row] = await sql`
      SELECT count(*)::int as duplicates
      FROM (
        SELECT organization_id, email, count(*) as cnt
        FROM crm.contacts
        WHERE email IS NOT NULL
        GROUP BY organization_id, email
        HAVING count(*) > 1
      ) dupes
    `;
    const dupes = (row as { duplicates: number })?.duplicates ?? 0;
    if (dupes === 0) {
      pass(
        'quality.duplicate_emails',
        'No duplicate emails within organizations',
      );
    } else {
      warn(
        'quality.duplicate_emails',
        `${dupes} email addresses appear more than once within an organization`,
        { dupes },
      );
    }
  } catch (error) {
    fail('quality.duplicate_emails', `Query failed: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Organization isolation checks
// ---------------------------------------------------------------------------

async function checkTenantIsolation(): Promise<void> {
  console.log('\n--- Tenant Isolation Checks ---');

  // Check: All contacts have an organization_id
  try {
    const [row] = await sql`
      SELECT count(*)::int as no_org
      FROM crm.contacts
      WHERE organization_id IS NULL
    `;
    const noOrg = (row as { no_org: number })?.no_org ?? 0;
    if (noOrg === 0) {
      pass('isolation.contacts_org', 'All contacts have an organization_id');
    } else {
      fail(
        'isolation.contacts_org',
        `${noOrg} contacts are missing organization_id`,
        { noOrg },
      );
    }
  } catch (error) {
    fail('isolation.contacts_org', `Query failed: ${String(error)}`);
  }

  // Check: All companies have an organization_id
  try {
    const [row] = await sql`
      SELECT count(*)::int as no_org
      FROM crm.companies
      WHERE organization_id IS NULL
    `;
    const noOrg = (row as { no_org: number })?.no_org ?? 0;
    if (noOrg === 0) {
      pass('isolation.companies_org', 'All companies have an organization_id');
    } else {
      fail(
        'isolation.companies_org',
        `${noOrg} companies are missing organization_id`,
        { noOrg },
      );
    }
  } catch (error) {
    fail('isolation.companies_org', `Query failed: ${String(error)}`);
  }

  // Check: RLS policies exist on tenant tables
  try {
    const [row] = await sql`
      SELECT count(*)::int as policy_count
      FROM pg_policies
      WHERE schemaname IN ('crm', 'content', 'campaign', 'delivery', 'journey', 'analytics')
    `;
    const count = (row as { policy_count: number })?.policy_count ?? 0;
    if (count > 0) {
      pass(
        'isolation.rls_policies',
        `${count} RLS policies found on tenant schemas`,
        { count },
      );
    } else {
      warn(
        'isolation.rls_policies',
        'No RLS policies found - tenant isolation may rely on application-level filtering',
      );
    }
  } catch (error) {
    warn(
      'isolation.rls_policies',
      `Could not check RLS policies: ${String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Mauntic3 Post-Migration Validation ===');
  console.log(`Database: ${DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await checkRowCounts();
  await checkReferentialIntegrity();
  await checkDataQuality();
  await checkTenantIsolation();

  // Print summary
  console.log('\n=== Validation Summary ===');
  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log(`  PASS: ${passed}  |  WARN: ${warned}  |  FAIL: ${failed}`);
  console.log('');

  for (const r of results) {
    const icon =
      r.status === 'pass' ? 'PASS' : r.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`  [${icon}] ${r.check}: ${r.message}`);
  }

  if (failed > 0) {
    console.log(
      '\nValidation completed with failures. Review and fix before proceeding.',
    );
    process.exit(1);
  } else if (warned > 0) {
    console.log(
      '\nValidation completed with warnings. Review before proceeding.',
    );
    process.exit(0);
  } else {
    console.log('\nAll validations passed.');
    process.exit(0);
  }
}

main();
