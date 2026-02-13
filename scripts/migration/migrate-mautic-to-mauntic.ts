/**
 * Mautic -> Mauntic3 Data Migration Orchestrator
 *
 * This script connects to a source Mautic MySQL database and migrates all
 * data to the target Mauntic3 Neon Postgres database.
 *
 * Prerequisites:
 *   - Source MySQL database accessible (MAUTIC_MYSQL_URL env var)
 *   - Target Neon Postgres database accessible (DATABASE_URL env var)
 *   - Target schemas already created via `pnpm -w run db:migrate`
 *
 * Usage:
 *   MAUTIC_MYSQL_URL="mysql://user:pass@host/mautic" \
 *   DATABASE_URL="postgresql://user:pass@host/mauntic" \
 *   npx tsx scripts/migration/migrate-mautic-to-mauntic.ts [--dry-run] [--batch-size=1000]
 */

import { neon } from '@neondatabase/serverless';
import {
  CONTACT_FIELD_MAP,
  CONTACT_CUSTOM_FIELD_KEYS,
  COMPANY_FIELD_MAP,
  COMPANY_CUSTOM_FIELD_KEYS,
  EMAIL_TEMPLATE_FIELD_MAP,
  FORM_FIELD_MAP,
  LANDING_PAGE_FIELD_MAP,
  CAMPAIGN_FIELD_MAP,
  CATEGORY_FIELD_MAP,
  mapMauticStatus,
  extractDomain,
  mapCompanySize,
} from './field-mapping.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(
  args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? '1000',
  10,
);

const MAUTIC_MYSQL_URL = process.env.MAUTIC_MYSQL_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MAUTIC_MYSQL_URL) {
  console.error('ERROR: MAUTIC_MYSQL_URL environment variable is required');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MigrationStats {
  step: string;
  sourceCount: number;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  durationMs: number;
}

interface IdMap {
  /** Maps old Mautic integer ID -> new Mauntic3 UUID */
  [oldId: number]: string;
}

// ---------------------------------------------------------------------------
// MySQL client placeholder
// ---------------------------------------------------------------------------

/**
 * Creates a MySQL connection for reading the source Mautic database.
 *
 * TODO: Install mysql2 and replace this placeholder:
 *   import mysql from 'mysql2/promise';
 *   const mysqlConn = await mysql.createConnection(MAUTIC_MYSQL_URL);
 *
 * For now, this returns a mock that explains the expected interface.
 */
async function createMysqlConnection(_url: string) {
  // TODO: Replace with actual MySQL connection
  // import mysql from 'mysql2/promise';
  // return mysql.createConnection(url);

  return {
    async query<T = Record<string, unknown>[]>(
      _sql: string,
      _params?: unknown[],
    ): Promise<[T, unknown]> {
      console.warn('  [MOCK] MySQL query - install mysql2 to enable real migration');
      return [[] as unknown as T, null];
    },
    async end(): Promise<void> {
      // no-op
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres target
// ---------------------------------------------------------------------------

const sql = neon(DATABASE_URL!);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUUID(): string {
  return crypto.randomUUID();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] ${message}${dataStr}`);
}

// ---------------------------------------------------------------------------
// Step 1: Connect to databases
// ---------------------------------------------------------------------------

async function connectDatabases() {
  log('Step 1: Connecting to databases...');

  const mysqlConn = await createMysqlConnection(MAUTIC_MYSQL_URL!);

  // Verify Postgres connectivity
  const [pgResult] = await sql`SELECT 1 as connected`;
  if (!pgResult) throw new Error('Failed to connect to Postgres');
  log('  Postgres connected');

  return { mysqlConn };
}

// ---------------------------------------------------------------------------
// Step 2: Create default organization
// ---------------------------------------------------------------------------

async function createDefaultOrganization(): Promise<string> {
  log('Step 2: Creating default organization...');

  const orgId = generateUUID();
  const slug = 'migrated-org';

  if (!DRY_RUN) {
    await sql`
      INSERT INTO identity.organizations (id, name, slug, is_blocked, created_at, updated_at)
      VALUES (${orgId}, 'Migrated Organization', ${slug}, false, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `;
  }

  log(`  Organization created: ${orgId}`, { slug });
  return orgId;
}

// ---------------------------------------------------------------------------
// Step 3: Migrate users
// ---------------------------------------------------------------------------

async function migrateUsers(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats; userIdMap: IdMap }> {
  const start = Date.now();
  log('Step 3: Migrating users...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT id, username, email, first_name, last_name, role_id, date_added, last_login, last_active FROM users',
  );

  const userIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();
      const oldId = row.id as number;
      userIdMap[oldId] = newId;

      const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown User';
      const email = row.email as string;
      const role = (row.role_id as number) === 1 ? 'admin' : 'member';

      if (!DRY_RUN) {
        // Insert into identity.users
        await sql`
          INSERT INTO identity.users (id, email, name, role, is_blocked, email_verified, created_at, updated_at)
          VALUES (${newId}, ${email}, ${name}, ${role}, false, true, ${row.date_added as string ?? new Date().toISOString()}, NOW())
          ON CONFLICT (email) DO NOTHING
        `;

        // Insert into identity.organization_members
        const memberId = generateUUID();
        await sql`
          INSERT INTO identity.organization_members (id, organization_id, user_id, role, joined_at, updated_at)
          VALUES (${memberId}, ${organizationId}, ${newId}, ${role === 'admin' ? 'admin' : 'member'}, NOW(), NOW())
          ON CONFLICT (organization_id, user_id) DO NOTHING
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating user ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'users',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Users: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, userIdMap };
}

// ---------------------------------------------------------------------------
// Step 4: Migrate contacts (leads)
// ---------------------------------------------------------------------------

async function migrateContacts(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats; contactIdMap: IdMap }> {
  const start = Date.now();
  log('Step 4: Migrating contacts...');

  const contactIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  let totalSource = 0;

  // Paginate through leads
  while (true) {
    const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
      `SELECT l.*, dnc.reason as dnc_reason
       FROM leads l
       LEFT JOIN lead_donotcontact dnc ON l.id = dnc.lead_id
       ORDER BY l.id ASC
       LIMIT ? OFFSET ?`,
      [BATCH_SIZE, offset],
    );

    if (rows.length === 0) break;
    totalSource += rows.length;

    for (const row of rows) {
      try {
        const newId = generateUUID();
        const oldId = row.id as number;
        contactIdMap[oldId] = newId;

        // Build custom fields
        const customFields: Record<string, unknown> = { mautic_id: oldId };
        for (const key of CONTACT_CUSTOM_FIELD_KEYS) {
          if (row[key] != null && row[key] !== '') {
            customFields[key] = row[key];
          }
        }
        if (row.points != null) {
          customFields.mautic_points = row.points;
        }

        const status = mapMauticStatus(row.dnc_reason as number | null);

        if (!DRY_RUN) {
          await sql`
            INSERT INTO crm.contacts (
              id, organization_id, email, first_name, last_name, phone,
              status, custom_fields, last_activity_at, created_at, updated_at
            )
            VALUES (
              ${newId}, ${organizationId},
              ${(row.email as string) ?? null},
              ${(row.firstname as string) ?? null},
              ${(row.lastname as string) ?? null},
              ${(row.phone as string) ?? null},
              ${status},
              ${JSON.stringify(customFields)}::jsonb,
              ${(row.last_active as string) ?? null},
              ${(row.date_added as string) ?? new Date().toISOString()},
              ${(row.date_modified as string) ?? new Date().toISOString()}
            )
          `;
        }

        migrated++;
      } catch (error) {
        log(`  Error migrating contact ${row.id}:`, { error: String(error) });
        errors++;
      }
    }

    offset += BATCH_SIZE;
    log(`  Processed ${offset} contacts...`);
  }

  const stats: MigrationStats = {
    step: 'contacts',
    sourceCount: totalSource,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Contacts: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, contactIdMap };
}

// ---------------------------------------------------------------------------
// Step 5: Migrate companies
// ---------------------------------------------------------------------------

async function migrateCompanies(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats; companyIdMap: IdMap }> {
  const start = Date.now();
  log('Step 5: Migrating companies...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM companies ORDER BY id ASC',
  );

  const companyIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();
      const oldId = row.id as number;
      companyIdMap[oldId] = newId;

      const customFields: Record<string, unknown> = { mautic_id: oldId };
      for (const key of COMPANY_CUSTOM_FIELD_KEYS) {
        if (row[key] != null && row[key] !== '') {
          customFields[key] = row[key];
        }
      }

      const domain = extractDomain(row.companywebsite as string | null);
      const size = mapCompanySize(row.company_number_of_employees as string | null);

      if (!DRY_RUN) {
        await sql`
          INSERT INTO crm.companies (
            id, organization_id, name, domain, industry, size,
            custom_fields, created_at, updated_at
          )
          VALUES (
            ${newId}, ${organizationId},
            ${(row.companyname as string) ?? 'Unknown Company'},
            ${domain},
            ${(row.companyindustry as string) ?? null},
            ${size},
            ${JSON.stringify(customFields)}::jsonb,
            ${(row.date_added as string) ?? new Date().toISOString()},
            ${(row.date_modified as string) ?? new Date().toISOString()}
          )
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating company ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'companies',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Companies: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, companyIdMap };
}

// ---------------------------------------------------------------------------
// Step 6: Migrate email templates
// ---------------------------------------------------------------------------

async function migrateEmailTemplates(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
  userIdMap: IdMap,
): Promise<{ stats: MigrationStats; templateIdMap: IdMap }> {
  const start = Date.now();
  log('Step 6: Migrating email templates...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM emails WHERE email_type = "template" ORDER BY id ASC',
  );

  const templateIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();
      const oldId = row.id as number;
      templateIdMap[oldId] = newId;

      const createdBy = userIdMap[row.created_by as number] ?? null;

      if (!DRY_RUN) {
        await sql`
          INSERT INTO content.templates (
            id, organization_id, name, type, subject, body_html, body_text,
            is_active, created_by, created_at, updated_at
          )
          VALUES (
            ${newId}, ${organizationId},
            ${(row.name as string) ?? 'Untitled'},
            'email',
            ${(row.subject as string) ?? null},
            ${(row.custom_html as string) ?? null},
            ${(row.plain_text as string) ?? null},
            ${row.is_published === 1},
            ${createdBy},
            ${(row.date_added as string) ?? new Date().toISOString()},
            ${(row.date_modified as string) ?? new Date().toISOString()}
          )
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating template ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'email_templates',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Email templates: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, templateIdMap };
}

// ---------------------------------------------------------------------------
// Step 7: Migrate forms
// ---------------------------------------------------------------------------

async function migrateForms(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats; formIdMap: IdMap }> {
  const start = Date.now();
  log('Step 7: Migrating forms...');

  const [formRows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM forms ORDER BY id ASC',
  );

  const formIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of formRows) {
    try {
      const newId = generateUUID();
      const oldId = row.id as number;
      formIdMap[oldId] = newId;

      // Load form fields
      const [fieldRows] = await mysqlConn.query<Record<string, unknown>[]>(
        'SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order ASC',
        [oldId],
      );

      const fields = fieldRows.map((f) => ({
        name: f.alias as string,
        label: f.label as string,
        type: f.type as string,
        is_required: f.is_required === 1,
        order: f.field_order as number,
        mautic_id: f.id,
      }));

      const settings: Record<string, unknown> = {
        form_type: row.form_type,
        post_action: row.post_action,
        mautic_id: oldId,
      };

      if (!DRY_RUN) {
        await sql`
          INSERT INTO content.forms (
            id, organization_id, name, description, fields, settings,
            redirect_url, is_active, created_at, updated_at
          )
          VALUES (
            ${newId}, ${organizationId},
            ${(row.name as string) ?? 'Untitled Form'},
            ${(row.description as string) ?? null},
            ${JSON.stringify(fields)}::jsonb,
            ${JSON.stringify(settings)}::jsonb,
            ${(row.post_action_property as string) ?? null},
            ${row.is_published === 1},
            ${(row.date_added as string) ?? new Date().toISOString()},
            ${(row.date_modified as string) ?? new Date().toISOString()}
          )
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating form ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'forms',
    sourceCount: formRows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Forms: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, formIdMap };
}

// ---------------------------------------------------------------------------
// Step 8: Migrate landing pages
// ---------------------------------------------------------------------------

async function migrateLandingPages(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats }> {
  const start = Date.now();
  log('Step 8: Migrating landing pages...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM pages ORDER BY id ASC',
  );

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();
      const slug = (row.alias as string) ?? `page-${row.id}`;

      if (!DRY_RUN) {
        await sql`
          INSERT INTO content.landing_pages (
            id, organization_id, name, slug, is_published,
            published_at, visit_count, created_at, updated_at
          )
          VALUES (
            ${newId}, ${organizationId},
            ${(row.title as string) ?? 'Untitled Page'},
            ${slug},
            ${row.is_published === 1},
            ${row.is_published === 1 ? ((row.publish_up as string) ?? new Date().toISOString()) : null},
            ${(row.hits as number) ?? 0},
            ${(row.date_added as string) ?? new Date().toISOString()},
            ${(row.date_modified as string) ?? new Date().toISOString()}
          )
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating page ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'landing_pages',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Landing pages: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats };
}

// ---------------------------------------------------------------------------
// Step 9: Migrate campaigns
// ---------------------------------------------------------------------------

async function migrateCampaigns(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
  userIdMap: IdMap,
): Promise<{ stats: MigrationStats; campaignIdMap: IdMap }> {
  const start = Date.now();
  log('Step 9: Migrating campaigns...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM campaigns ORDER BY id ASC',
  );

  const campaignIdMap: IdMap = {};
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();
      const oldId = row.id as number;
      campaignIdMap[oldId] = newId;

      const status = row.is_published === 1 ? 'sent' : 'draft';
      const createdBy = userIdMap[row.created_by as number] ?? null;

      if (!DRY_RUN) {
        await sql`
          INSERT INTO campaign.campaigns (
            id, organization_id, name, description, type, status,
            created_by, created_at, updated_at
          )
          VALUES (
            ${newId}, ${organizationId},
            ${(row.name as string) ?? 'Untitled Campaign'},
            ${(row.description as string) ?? null},
            'email',
            ${status},
            ${createdBy},
            ${(row.date_added as string) ?? new Date().toISOString()},
            ${(row.date_modified as string) ?? new Date().toISOString()}
          )
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating campaign ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'campaigns',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Campaigns: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats, campaignIdMap };
}

// ---------------------------------------------------------------------------
// Step 10: Migrate categories -> tags
// ---------------------------------------------------------------------------

async function migrateCategories(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  organizationId: string,
): Promise<{ stats: MigrationStats }> {
  const start = Date.now();
  log('Step 10: Migrating categories to tags...');

  const [rows] = await mysqlConn.query<Record<string, unknown>[]>(
    'SELECT * FROM categories ORDER BY id ASC',
  );

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const newId = generateUUID();

      if (!DRY_RUN) {
        await sql`
          INSERT INTO crm.tags (id, organization_id, name, color, created_at)
          VALUES (
            ${newId}, ${organizationId},
            ${(row.title as string) ?? 'Untitled Tag'},
            ${(row.color as string) ?? '#6b7280'},
            ${(row.date_added as string) ?? new Date().toISOString()}
          )
          ON CONFLICT (organization_id, name) DO NOTHING
        `;
      }

      migrated++;
    } catch (error) {
      log(`  Error migrating category ${row.id}:`, { error: String(error) });
      errors++;
    }
  }

  const stats: MigrationStats = {
    step: 'categories_to_tags',
    sourceCount: rows.length,
    migratedCount: migrated,
    skippedCount: skipped,
    errorCount: errors,
    durationMs: Date.now() - start,
  };

  log(`  Categories->Tags: ${migrated} migrated, ${skipped} skipped, ${errors} errors`, {
    duration: formatDuration(stats.durationMs),
  });

  return { stats };
}

// ---------------------------------------------------------------------------
// Step 11: Validate row counts
// ---------------------------------------------------------------------------

async function validateRowCounts(
  mysqlConn: Awaited<ReturnType<typeof createMysqlConnection>>,
  allStats: MigrationStats[],
): Promise<void> {
  log('Step 11: Validating row counts...');

  const tables = [
    { source: 'users', target: 'identity.users', step: 'users' },
    { source: 'leads', target: 'crm.contacts', step: 'contacts' },
    { source: 'companies', target: 'crm.companies', step: 'companies' },
    { source: 'emails', target: 'content.templates', step: 'email_templates' },
    { source: 'forms', target: 'content.forms', step: 'forms' },
    { source: 'pages', target: 'content.landing_pages', step: 'landing_pages' },
    { source: 'campaigns', target: 'campaign.campaigns', step: 'campaigns' },
    { source: 'categories', target: 'crm.tags', step: 'categories_to_tags' },
  ];

  let allValid = true;

  for (const table of tables) {
    const stepStats = allStats.find((s) => s.step === table.step);
    if (!stepStats) continue;

    // Dynamic table name: use tagged template with raw SQL query helper
    const query = `SELECT count(*)::int as count FROM ${table.target}`;
    const targetResult = await sql(query as unknown as TemplateStringsArray);
    const targetCount = (targetResult[0] as { count: number })?.count ?? 0;

    const valid = targetCount === stepStats.migratedCount;
    const emoji = valid ? 'OK' : 'MISMATCH';

    log(`  [${emoji}] ${table.step}: source=${stepStats.sourceCount} migrated=${stepStats.migratedCount} target=${targetCount} errors=${stepStats.errorCount}`);

    if (!valid) allValid = false;
  }

  if (!allValid) {
    log('WARNING: Row count mismatches detected. Review errors above.');
  } else {
    log('All row counts validated successfully.');
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const totalStart = Date.now();

  log('=== Mautic -> Mauntic3 Migration ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Batch size: ${BATCH_SIZE}`);

  const allStats: MigrationStats[] = [];

  try {
    // Step 1: Connect
    const { mysqlConn } = await connectDatabases();

    // Step 2: Create default organization
    const organizationId = await createDefaultOrganization();

    // Step 3: Migrate users
    const { stats: userStats, userIdMap } = await migrateUsers(mysqlConn, organizationId);
    allStats.push(userStats);

    // Step 4: Migrate contacts
    const { stats: contactStats, contactIdMap } = await migrateContacts(mysqlConn, organizationId);
    allStats.push(contactStats);

    // Step 5: Migrate companies
    const { stats: companyStats, companyIdMap } = await migrateCompanies(mysqlConn, organizationId);
    allStats.push(companyStats);

    // Step 6: Migrate email templates
    const { stats: templateStats, templateIdMap } = await migrateEmailTemplates(
      mysqlConn,
      organizationId,
      userIdMap,
    );
    allStats.push(templateStats);

    // Step 7: Migrate forms
    const { stats: formStats, formIdMap } = await migrateForms(mysqlConn, organizationId);
    allStats.push(formStats);

    // Step 8: Migrate landing pages
    const { stats: pageStats } = await migrateLandingPages(mysqlConn, organizationId);
    allStats.push(pageStats);

    // Step 9: Migrate campaigns
    const { stats: campaignStats, campaignIdMap } = await migrateCampaigns(
      mysqlConn,
      organizationId,
      userIdMap,
    );
    allStats.push(campaignStats);

    // Step 10: Migrate categories -> tags
    const { stats: categoryStats } = await migrateCategories(mysqlConn, organizationId);
    allStats.push(categoryStats);

    // Step 11: Validate
    if (!DRY_RUN) {
      await validateRowCounts(mysqlConn, allStats);
    }

    // Close MySQL
    await mysqlConn.end();

    // Print summary
    const totalDuration = Date.now() - totalStart;
    log('');
    log('=== Migration Summary ===');
    log(`Total duration: ${formatDuration(totalDuration)}`);
    log(`Mode: ${DRY_RUN ? 'DRY RUN (no data written)' : 'LIVE'}`);
    log('');

    for (const stats of allStats) {
      log(
        `  ${stats.step.padEnd(20)} | source: ${String(stats.sourceCount).padStart(6)} | migrated: ${String(stats.migratedCount).padStart(6)} | errors: ${String(stats.errorCount).padStart(4)} | ${formatDuration(stats.durationMs)}`,
      );
    }

    const totalMigrated = allStats.reduce((sum, s) => sum + s.migratedCount, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errorCount, 0);
    log('');
    log(`Total migrated: ${totalMigrated}, Total errors: ${totalErrors}`);

    if (totalErrors > 0) {
      process.exit(1);
    }
  } catch (error) {
    log('FATAL ERROR during migration:', { error: String(error) });
    process.exit(1);
  }
}

main();
