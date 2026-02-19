# Deployment Guide

This document covers staging and production deployment for the Mauntic3 platform, including Cloudflare Workers deployment via Wrangler and Fly.io blue-green deployments.

## Architecture Overview

Mauntic3 is deployed across two platforms:

- **Cloudflare Workers** (10 workers): Gateway, Identity, Billing, CRM, Content, Campaign, Journey, Delivery, Analytics, Integrations
- **Fly.io** (3 services): Journey Executor, Delivery Engine, Analytics Aggregator

Supporting infrastructure:
- **Neon Postgres**: Primary database with Hyperdrive connection pooling
- **Cloudflare KV**: Session cache, org cache, provider config cache
- **Cloudflare R2**: Asset storage (images, files, exports)
- **Cloudflare Durable Objects**: Rate limiting (Gateway worker)
- **Redis** (Fly.io internal or Upstash): BullMQ job queues

## Staging Environment

### Neon Branch for Staging

Use Neon's branching feature to create an isolated staging database:

```bash
# Create a staging branch from main
neonctl branches create \
  --project-id <project-id> \
  --name staging \
  --parent main

# Get the connection string for the staging branch
neonctl connection-string staging --project-id <project-id>
```

The staging branch shares the same schema as production but has isolated data. It can be reset from the parent branch at any time.

### Cloudflare Workers Staging

Deploy workers to a staging environment using Wrangler environments:

```bash
# Deploy all workers to staging
for worker in gateway identity billing crm content campaign journey delivery analytics integrations; do
  cd workers/$worker
  wrangler deploy --env staging
  cd ../..
done
```

Each worker's `wrangler.toml` should have a `[env.staging]` section:

```toml
[env.staging]
name = "mauntic-crm-staging"

[env.staging.vars]
APP_DOMAIN = "staging.zeluto.com"

[[env.staging.hyperdrive]]
binding = "DB"
id = "<staging-hyperdrive-id>"
```

### Fly.io Staging

Deploy Fly.io services with staging configuration:

```bash
# Deploy to staging
for service in journey-executor delivery-engine analytics-aggregator; do
  cd services/$service
  fly deploy --app mauntic-${service}-staging --config fly.staging.toml
  cd ../..
done
```

### Staging Environment Variables

| Variable | Staging Value |
|---|---|
| `DATABASE_URL` | Neon staging branch connection string |
| `REDIS_URL` | Separate Redis instance or database number |
| `APP_DOMAIN` | `staging.zeluto.com` |
| `STRIPE_SECRET_KEY` | Stripe test mode key |
| `ENCRYPTION_KEY` | Separate encryption key for staging |

## Production Deployment

### Pre-deployment Checklist

1. All CI checks pass (typecheck, lint, test)
2. Database migrations are applied (`pnpm -w run db:migrate`)
3. Environment variables / secrets are configured
4. Monitoring and alerting is in place

### Cloudflare Workers - Zero-Downtime via Gradual Rollout

Wrangler supports gradual rollouts for Workers, allowing canary deployments:

```bash
# Step 1: Deploy with 10% traffic to new version
wrangler versions upload --env production

# Step 2: Split traffic (10% new, 90% old)
wrangler versions deploy \
  --version-id <new-version-id> --percentage 10 \
  --version-id <old-version-id> --percentage 90

# Step 3: Monitor error rates, latency, and logs
wrangler tail --env production --format json

# Step 4: If healthy, increase to 50%
wrangler versions deploy \
  --version-id <new-version-id> --percentage 50 \
  --version-id <old-version-id> --percentage 50

# Step 5: Full rollout
wrangler versions deploy \
  --version-id <new-version-id> --percentage 100
```

#### Rollback

If issues are detected during gradual rollout:

```bash
# Immediate rollback to previous version
wrangler versions deploy \
  --version-id <old-version-id> --percentage 100
```

### Deploy All Workers Script

```bash
#!/usr/bin/env bash
set -euo pipefail

WORKERS=(gateway identity billing crm content campaign journey delivery analytics integrations)

for worker in "${WORKERS[@]}"; do
  echo "Deploying $worker..."
  cd "workers/$worker"
  wrangler deploy --env production
  cd ../..
  echo "$worker deployed successfully"
done

echo "All workers deployed"
```

### Static Assets (Cloudflare R2 / Pages)

`workers/gateway` now expects a `STATIC_BASE_URL` (default `/assets`) that points to the public origin for CSS/JS artifacts. The gateway also exposes `/assets/*` which proxies to the `STATIC_ASSETS` R2 binding, so local dev can keep using relative URLs.

**Build + upload workflow**

1. Build Tailwind bundles from `@mauntic/ui-kit`:

   ```bash
   pnpm run static:build
   ```

   This runs `pnpm --filter @mauntic/ui-kit build:css`, writes `packages/ui-kit/dist/ui-kit.css`, and copies it to `dist/static/styles.css`.

2. Upload to R2 (or let CI do it):

   ```bash
   pnpm run static:upload
   # builds CSS and runs scripts/upload-static-assets.mjs
   ```

   The upload script publishes both `styles/latest.css` and `styles/<git-sha>.css` to the bucket defined by `STATIC_R2_BUCKET` (defaults to `mauntic-static-assets`). CI sets `GIT_SHA=${{ github.sha }}` automatically so versioned files pair with each deploy.

3. Set `STATIC_BASE_URL` per worker/env (e.g., `https://assets.zeluto.com` in production, `/assets` for wrangler dev). CI should upload assets before invoking `wrangler publish` so Worker responses always reference the latest CSS.

4. (Optional) If you serve via Cloudflare Pages instead of R2, point `STATIC_BASE_URL` to the Pages domain and skip the R2 upload step.

Documented commands live in the repo root `package.json` and run inside the Turbo pipeline target `static:build` so `pnpm turbo static:build` works in CI.

### Fly.io - Blue-Green Deployment

Fly.io supports blue-green deployments via machine management:

```bash
# Step 1: Deploy new version (creates new machines alongside old ones)
cd services/journey-executor
fly deploy --strategy bluegreen

# Step 2: Verify health checks pass
fly status --app mauntic-journey-executor

# Step 3: If healthy, Fly.io automatically routes traffic to new machines
# Old machines are kept running for a grace period

# Step 4: If issues, roll back
fly releases rollback --app mauntic-journey-executor
```

#### Fly.io Deployment Order

Deploy services in dependency order:

1. **delivery-engine** (no dependencies on other Fly services)
2. **analytics-aggregator** (no dependencies on other Fly services)
3. **journey-executor** (enqueues to delivery-engine via BullMQ, but loosely coupled)

```bash
for service in delivery-engine analytics-aggregator journey-executor; do
  echo "Deploying $service..."
  cd "services/$service"
  fly deploy --strategy bluegreen
  fly status --app "mauntic-${service}"
  cd ../..
  echo "$service deployed successfully"
done
```

### Database Migrations

Run database migrations before deploying application code:

```bash
# Generate migrations for all domains
pnpm -w run db:migrate

# Verify migrations applied correctly
npx tsx scripts/migration/validate-migration.ts
```

For schema changes that require both old and new code to work:

1. Deploy migration that adds new columns/tables (backward compatible)
2. Deploy new application code that uses the new schema
3. Deploy migration that removes old columns/tables (cleanup)

### Secret Management

Secrets are stored in each platform's secret management:

```bash
# Cloudflare Workers secrets
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET

# Fly.io secrets
fly secrets set DATABASE_URL="postgresql://..." --app mauntic-journey-executor
fly secrets set REDIS_URL="redis://..." --app mauntic-journey-executor
fly secrets set ENCRYPTION_KEY="..." --app mauntic-journey-executor
```

## Monitoring Deployment Health

### Cloudflare Workers

- **Cloudflare Dashboard** > Workers & Pages > Select worker > Analytics
- **Real-time logs**: `wrangler tail --env production`
- **Error rate**: Monitor 5xx responses in analytics
- **Latency**: P50/P99 in worker analytics

### Fly.io Services

- **Fly Dashboard**: https://fly.io/apps/mauntic-journey-executor
- **Logs**: `fly logs --app mauntic-journey-executor`
- **Health checks**: Configured in `fly.toml` with HTTP health endpoints
- **Metrics**: `fly metrics --app mauntic-journey-executor`

### Database

- **Neon Dashboard**: Query performance, connection count, storage
- **Hyperdrive**: Connection pool utilization in Cloudflare dashboard

## Deployment Frequency

Recommended deployment cadence:

- **Hotfixes**: Immediate deployment to production via gradual rollout
- **Features**: Deploy to staging first, verify for 1-2 hours, then production
- **Database migrations**: Always deploy during low-traffic windows (if destructive)
- **Infrastructure changes**: Schedule maintenance window, coordinate across teams
