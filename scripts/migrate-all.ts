import { execSync } from 'node:child_process';

const migrationOrder = [
  'identity-domain',
  'billing-domain',
  'crm-domain',
  'content-domain',
  'campaign-domain',
  'delivery-domain',
  'journey-domain',
  'analytics-domain',
  'integrations-domain',
  'lead-intelligence-domain',
  'scoring-domain',
  'revops-domain',
];

async function migrateAll() {
  for (const domain of migrationOrder) {
    console.log(`Migrating ${domain}...`);
    try {
      execSync(`pnpm --filter @mauntic/${domain} db:generate`, {
        stdio: 'inherit',
      });
      console.log(`  ✓ ${domain} migrated`);
    } catch (err) {
      console.error(`  ✗ ${domain} failed:`, err);
      process.exit(1);
    }
  }
  console.log('All migrations complete.');
}

migrateAll().catch(console.error);
