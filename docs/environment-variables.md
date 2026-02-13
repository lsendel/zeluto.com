# Environment Variables

This document lists all environment variables and secrets required by each service in the Mauntic3 platform.

## Cloudflare Workers

Workers use two mechanisms for configuration:

1. **`[vars]` in `wrangler.toml`**: Non-secret configuration values
2. **`wrangler secret put`**: Secret values (API keys, connection strings)
3. **`.dev.vars`**: Local development overrides (not committed to git)

### Gateway Worker (`mauntic-gateway`)

| Variable | Type | Description |
|---|---|---|
| `APP_DOMAIN` | var | Application domain (e.g., `17way.com`) |
| `JWT_SECRET` | secret | Secret key for JWT verification |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `KV` | KV Namespace | Session cache, rate limit state |
| `DB` | Hyperdrive | Database connection via Hyperdrive |
| `RATE_LIMITER` | Durable Object | Rate limiting state |
| `IDENTITY` | Service Binding | Identity worker |
| `BILLING` | Service Binding | Billing worker |
| `CRM` | Service Binding | CRM worker |
| `JOURNEY` | Service Binding | Journey worker |
| `DELIVERY` | Service Binding | Delivery worker |
| `CAMPAIGN` | Service Binding | Campaign worker |
| `CONTENT` | Service Binding | Content worker |
| `ANALYTICS` | Service Binding | Analytics worker |
| `INTEGRATIONS` | Service Binding | Integrations worker |

### Identity Worker (`mauntic-identity`)

| Variable | Type | Description |
|---|---|---|
| `APP_DOMAIN` | var | Application domain |
| `BETTER_AUTH_URL` | var | Better Auth base URL (e.g., `https://17way.com`) |
| `BETTER_AUTH_SECRET` | secret | Better Auth secret key |
| `GOOGLE_CLIENT_ID` | secret | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret (optional) |
| `GITHUB_CLIENT_ID` | secret | GitHub OAuth client ID (optional) |
| `GITHUB_CLIENT_SECRET` | secret | GitHub OAuth client secret (optional) |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Session cache |

### Billing Worker (`mauntic-billing`)

| Variable | Type | Description |
|---|---|---|
| `APP_DOMAIN` | var | Application domain |
| `STRIPE_SECRET_KEY` | secret | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | secret | Stripe webhook signing secret |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |

### CRM Worker (`mauntic-crm`)

| Variable | Type | Description |
|---|---|---|
| (none required) | | |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Contact/segment cache |
| `EVENTS` | Queue Producer | CRM event queue |

### Content Worker (`mauntic-content`)

| Variable | Type | Description |
|---|---|---|
| (none required) | | |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Template cache |
| `ASSETS` | R2 Bucket | Asset storage (images, files) |

### Campaign Worker (`mauntic-campaign`)

| Variable | Type | Description |
|---|---|---|
| (none required) | | |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `HYPERDRIVE` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Campaign cache |
| `EVENTS` | Queue Producer | Campaign event queue |

### Journey Worker (`mauntic-journey`)

| Variable | Type | Description |
|---|---|---|
| (none required) | | |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `HYPERDRIVE` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Journey cache |
| `EVENTS` | Queue Producer | Journey event queue |

### Delivery Worker (`mauntic-delivery`)

| Variable | Type | Description |
|---|---|---|
| `ENCRYPTION_KEY` | secret | Key for encrypting/decrypting provider configs |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Suppression cache, provider cache |

### Analytics Worker (`mauntic-analytics`)

| Variable | Type | Description |
|---|---|---|
| (none required) | | |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Analytics cache |

### Integrations Worker (`mauntic-integrations`)

| Variable | Type | Description |
|---|---|---|
| `ENCRYPTION_KEY` | secret | Key for encrypting integration credentials |

**Bindings:**

| Binding | Type | Description |
|---|---|---|
| `DB` | Hyperdrive | Database connection |
| `KV` | KV Namespace | Connection cache |

---

## Fly.io Services

Fly.io services use environment variables set via `fly.toml` (`[env]` section) and secrets set via `fly secrets set`.

### Journey Executor (`mauntic-journey-executor`)

| Variable | Type | Description |
|---|---|---|
| `NODE_ENV` | env | `production` or `development` |
| `PORT` | env | Health check HTTP port (default: `8080`) |
| `DATABASE_URL` | secret | Neon Postgres connection string |
| `REDIS_URL` | secret | Redis connection string for BullMQ |
| `ENCRYPTION_KEY` | secret | Encryption key for sensitive data |

### Delivery Engine (`mauntic-delivery-engine`)

| Variable | Type | Description |
|---|---|---|
| `NODE_ENV` | env | `production` or `development` |
| `PORT` | env | Health check HTTP port (default: `8080`) |
| `DATABASE_URL` | secret | Neon Postgres connection string |
| `REDIS_URL` | secret | Redis connection string for BullMQ |
| `ENCRYPTION_KEY` | secret | Key for decrypting provider configs |

### Analytics Aggregator (`mauntic-analytics-aggregator`)

| Variable | Type | Description |
|---|---|---|
| `NODE_ENV` | env | `production` or `development` |
| `PORT` | env | Health check HTTP port (default: `8080`) |
| `DATABASE_URL` | secret | Neon Postgres connection string |
| `REDIS_URL` | secret | Redis connection string for BullMQ |

---

## Scripts

### Migration Scripts (`scripts/migration/`)

| Variable | Description |
|---|---|
| `MAUTIC_MYSQL_URL` | Source Mautic MySQL connection string |
| `DATABASE_URL` | Target Neon Postgres connection string |

### Database Scripts (`scripts/`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |

---

## Local Development

For local development, use `.dev.vars` files for Workers and `.env` files for Fly.io services.

### Common `.dev.vars` (Workers)

```bash
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
```

### Common `.env` (Fly.io services)

```bash
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://mauntic:mauntic@localhost:5432/mauntic_dev
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=local-dev-encryption-key-32chars!
```

---

## Secrets Management

### Production Secrets Checklist

Before deploying to production, ensure the following secrets are set:

**Cloudflare Workers:**

```bash
# Gateway
wrangler secret put JWT_SECRET --name mauntic-gateway

# Identity
wrangler secret put BETTER_AUTH_SECRET --name mauntic-identity
wrangler secret put GOOGLE_CLIENT_ID --name mauntic-identity      # optional
wrangler secret put GOOGLE_CLIENT_SECRET --name mauntic-identity   # optional
wrangler secret put GITHUB_CLIENT_ID --name mauntic-identity       # optional
wrangler secret put GITHUB_CLIENT_SECRET --name mauntic-identity   # optional

# Billing
wrangler secret put STRIPE_SECRET_KEY --name mauntic-billing
wrangler secret put STRIPE_WEBHOOK_SECRET --name mauntic-billing

# Delivery
wrangler secret put ENCRYPTION_KEY --name mauntic-delivery

# Integrations
wrangler secret put ENCRYPTION_KEY --name mauntic-integrations
```

**Fly.io Services:**

```bash
# Journey Executor
fly secrets set DATABASE_URL="postgresql://..." --app mauntic-journey-executor
fly secrets set REDIS_URL="redis://..." --app mauntic-journey-executor
fly secrets set ENCRYPTION_KEY="..." --app mauntic-journey-executor

# Delivery Engine
fly secrets set DATABASE_URL="postgresql://..." --app mauntic-delivery-engine
fly secrets set REDIS_URL="redis://..." --app mauntic-delivery-engine
fly secrets set ENCRYPTION_KEY="..." --app mauntic-delivery-engine

# Analytics Aggregator
fly secrets set DATABASE_URL="postgresql://..." --app mauntic-analytics-aggregator
fly secrets set REDIS_URL="redis://..." --app mauntic-analytics-aggregator
```

### Security Notes

- Never commit `.dev.vars`, `.env`, or any file containing secrets to version control
- Use different encryption keys for staging and production
- Rotate Stripe webhook secrets if compromised
- Rotate `BETTER_AUTH_SECRET` only during planned maintenance (invalidates all sessions)
- Use Neon's role-based access control to limit database permissions per service
