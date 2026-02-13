# Local Development Setup

This guide walks through setting up the Mauntic3 development environment on your local machine.

## Prerequisites

| Tool | Version | Installation |
|---|---|---|
| Node.js | 22+ | https://nodejs.org or `nvm install 22` |
| pnpm | 10+ | `npm install -g pnpm@10` |
| Docker | Latest | https://docs.docker.com/get-docker/ |
| Wrangler | Latest | `npm install -g wrangler` (or use via npx) |
| Fly CLI | Latest | https://fly.io/docs/flyctl/install/ |
| Turbo | Latest | Installed as devDependency |

## 1. Clone and Install

```bash
git clone <repository-url> mauntic3
cd mauntic3
pnpm install
```

## 2. Start Infrastructure Services

Start Postgres and Redis via Docker Compose:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432` (user: `mauntic`, password: `mauntic`, db: `mauntic_dev`)
- **Redis 7** on `localhost:6379`

Verify services are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

## 3. Environment Variables

Create a `.dev.vars` file in each worker directory for Wrangler local development. Most workers need:

```bash
# workers/<worker-name>/.dev.vars
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
```

For the identity worker:

```bash
# workers/identity/.dev.vars
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
BETTER_AUTH_SECRET=dev-secret-key-change-in-production
```

For the billing worker:

```bash
# workers/billing/.dev.vars
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For Fly.io services, create a `.env` file:

```bash
# services/journey-executor/.env
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=dev-encryption-key-32-chars-long!!
```

## 4. Initialize the Database

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

## 5. Starting Services

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

## 6. Running Tests

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

## 7. Code Generation

### Drizzle Schema Changes

After modifying a domain's Drizzle schema:

```bash
# Generate migration SQL
pnpm --filter @mauntic/crm-domain db:generate

# Apply to local database
npx tsx scripts/migrate-all.ts
```

## 8. Project Structure

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

## 9. Useful Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm turbo build` | Build all packages |
| `pnpm turbo dev` | Start all workers in dev mode |
| `pnpm turbo test` | Run all tests |
| `pnpm turbo typecheck` | Type check all packages |
| `pnpm turbo lint` | Lint all packages |
| `pnpm --filter @mauntic/<pkg> <cmd>` | Run command for specific package |

## 10. Troubleshooting

### Postgres connection refused

Make sure Docker is running and the postgres container is healthy:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs postgres
```

### Redis connection refused

Check the Redis container:

```bash
docker compose -f docker-compose.dev.yml logs redis
redis-cli ping  # Should return PONG
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
