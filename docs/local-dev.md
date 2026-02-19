# Local Development Setup

This guide walks through setting up the Mauntic3 development environment on your local machine.

## Prerequisites

| Tool | Version | Installation |
|---|---|---|
| Node.js | 22+ | https://nodejs.org or `nvm install 22` |
| pnpm | 10+ | `npm install -g pnpm@10` |
| Wrangler | Latest | `npm install -g wrangler` (or use via npx) |
| Fly CLI | Latest | https://fly.io/docs/flyctl/install/ |
| Turbo | Latest | Installed as devDependency |

## 1. Clone and Install

```bash
git clone <repository-url> mauntic3
cd mauntic3
pnpm install
```

## 2. Environment Variables

Create a `.dev.vars` file in each worker directory for Wrangler local development. Most workers need:

```bash
# workers/<worker-name>/.dev.vars
DATABASE_URL=postgresql://neondb_owner:npg_8KTCgZUb1Dvl@ep-jolly-pine-ai35q07s-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
```

For the identity worker:

```bash
# workers/identity/.dev.vars
DATABASE_URL=postgresql://neondb_owner:npg_8KTCgZUb1Dvl@ep-jolly-pine-ai35q07s-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
BETTER_AUTH_SECRET=dev-secret-key-change-in-production
```

For the billing worker:

```bash
# workers/billing/.dev.vars
DATABASE_URL=postgresql://neondb_owner:npg_8KTCgZUb1Dvl@ep-jolly-pine-ai35q07s-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For workers that render HTML (gateway, onboarding, auth flows) add the static asset binding defaults:

```bash
# workers/gateway/.dev.vars (excerpt)
STATIC_BASE_URL=/assets
```

Running `pnpm run static:build` once and uploading with `pnpm run static:upload` populates the `STATIC_ASSETS` R2 bucket so `/assets/styles/latest.css` works while developing locally.

For Fly.io services, create a `.env` file:

```bash
# services/journey-executor/.env
DATABASE_URL=postgresql://neondb_owner:npg_8KTCgZUb1Dvl@ep-jolly-pine-ai35q07s-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=dev-encryption-key-32-chars-long!!
```

## 3. Initialize the Database

Create all schemas and run migrations:

```bash
# Create schemas (identity, crm, content, campaign, journey, delivery, analytics, billing, integrations)
npx tsx scripts/init-schemas.ts

# Apply RLS policies
npx tsx scripts/apply-rls.ts

# Run Drizzle migrations for all domains
npx tsx scripts/migrate-all.ts

# Seed with sample data (optional)
npx tsx scripts/seed.ts
```

## 4. Starting Services

### Cloudflare Workers (Local Dev)

Start all workers in development mode:

```bash
pnpm turbo dev
```

Or start individual workers:

```bash
cd workers/gateway && wrangler dev
cd workers/identity && wrangler dev
cd workers/crm && wrangler dev
# etc.
```

Each worker starts on a different port. The gateway worker routes to other workers via Cloudflare service bindings (in production) or direct HTTP calls (in local dev).

#### Core Cloudflare stack (`dev:core`)

To avoid booting every Worker/Queue combo, run only the core HTTP workers (gateway, identity, CRM, campaign, analytics) plus their queue consumers with:

```bash
pnpm run dev:core
```

This script wraps `turbo run dev --parallel --no-cache` with a curated filter list:

| Scope | Package |
| --- | --- |
| Gateway shell | `@mauntic/gateway` |
| Auth/session | `@mauntic/identity` |
| CRM APIs | `@mauntic/crm` |
| Campaign composer | `@mauntic/campaign` |
| Analytics dashboards | `@mauntic/analytics` |
| Fan-out processors | `@mauntic/campaign-queue`, `@mauntic/journey`, `@mauntic/journey-queue`, `@mauntic/analytics-queue` |

Add more packages temporarily via either environment variable or passthrough filters:

```bash
# 1) Environment variable (comma-separated package names)
DEV_CORE_FILTERS='@mauntic/content,@mauntic/delivery' pnpm run dev:core

# 2) Pass turbo flags straight through
pnpm run dev:core -- --filter @mauntic/content --filter @mauntic/delivery
```

The script deduplicates packages, so you can safely mix both approaches. Kill the process with `Ctrl+C` when you are done; Turbo will stop every watcher.

### Fly.io Services (Local Dev)

Run Fly.io services locally with Node.js:

```bash
# Terminal 1: Journey Executor
cd services/journey-executor
npx tsx src/index.ts

# Terminal 2: Delivery Engine
cd services/delivery-engine
npx tsx src/index.ts

# Terminal 3: Analytics Aggregator
cd services/analytics-aggregator
npx tsx src/index.ts
```

## 5. Running Tests

### Unit Tests

```bash
# Run all tests
pnpm turbo test

# Run tests for a specific package
pnpm --filter @mauntic/crm-domain test
pnpm --filter @mauntic/identity-domain test
```

### End-to-End Tests

E2E tests require all services to be running:

```bash
# Start all services first, then:
cd tests/e2e
E2E_BASE_URL=http://localhost:8787 pnpm test
```

### Type Checking

```bash
pnpm turbo typecheck
```

## 6. Code Generation

### Drizzle Schema Changes

After modifying a domain's Drizzle schema:

```bash
# Generate migration SQL
pnpm --filter @mauntic/crm-domain db:generate

# Apply to local database
npx tsx scripts/migrate-all.ts
```

## 7. Project Structure

```
mauntic3/
  packages/
    contracts/          # ts-rest API contracts (shared schemas)
    domain-kernel/      # DDD building blocks
    worker-lib/         # Cloudflare Worker middleware
    process-lib/        # Fly.io service utilities
    ui-kit/             # Shared UI components
    domains/
      identity-domain/  # User, Organization entities
      billing-domain/   # Plans, Subscriptions entities
      crm-domain/       # Contact, Company, Segment entities
      content-domain/   # Template, Form, LandingPage entities
      campaign-domain/  # Campaign, AbTest entities
      delivery-domain/  # DeliveryJob, Provider entities
      journey-domain/   # Journey, Step, Execution entities
      analytics-domain/ # EventAggregate, DailyStats entities
      integrations-domain/ # Connection, Webhook entities
  workers/
    gateway/            # API gateway (routing, auth, rate limiting)
    identity/           # Auth, users, organizations
    billing/            # Plans, subscriptions, usage
    crm/                # Contacts, companies, segments
    content/            # Templates, forms, landing pages
    campaign/           # Campaigns, A/B tests
    journey/            # Journey builder, triggers
    delivery/           # Message sending, providers
    analytics/          # Reporting, dashboards
    integrations/       # Third-party connections
  services/
    journey-executor/   # BullMQ worker for journey steps
    delivery-engine/    # BullMQ worker for email/SMS/push
    analytics-aggregator/ # BullMQ worker for aggregation
  scripts/
    init-schemas.ts     # Create Postgres schemas
    apply-rls.ts        # Apply RLS policies
    migrate-all.ts      # Run all Drizzle migrations
    seed.ts             # Seed sample data
    migration/          # Mautic -> Mauntic3 migration
  tests/
    e2e/                # End-to-end test scaffolding
  docs/                 # Documentation
  infrastructure/       # Infrastructure configs (mail, etc.)
```

## 8. Useful Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm turbo build` | Build all packages |
| `pnpm turbo dev` | Start all workers in dev mode |
| `pnpm turbo test` | Run all tests |
| `pnpm turbo typecheck` | Type check all packages |
| `pnpm turbo lint` | Lint all packages |
| `pnpm --filter @mauntic/<pkg> <cmd>` | Run command for specific package |

## 9. Troubleshooting

### Postgres connection refused

Ensure the Neon connection string in `.dev.vars` is correct and that your IP has access. You can validate connectivity with `psql`:

```bash
psql "$DATABASE_URL" -c 'SELECT version();'
```

### Redis connection refused

If you're using a local Redis install (Homebrew, apt, etc.) make sure the service is running, or update `REDIS_URL` to point at a hosted instance (Upstash, Fly, etc.). To test the URL:

```bash
redis-cli -u "$REDIS_URL" ping  # Should return PONG
```

### Wrangler dev fails

Ensure you have a valid `.dev.vars` file in the worker directory. Also check that Hyperdrive bindings are mocked in local dev (Wrangler handles this automatically for local development).

### pnpm install fails

Try clearing the store and reinstalling:

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```
