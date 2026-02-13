# Performance Optimization Notes

This document covers key performance considerations for the Mauntic3 platform including query optimization, indexing strategy, caching, connection pooling, and CDN configuration.

## Key Queries Requiring EXPLAIN ANALYZE

The following queries are high-frequency or involve large data sets and should be profiled with `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` in production:

### CRM Domain

```sql
-- Contact list with pagination (most frequent query)
EXPLAIN ANALYZE
SELECT * FROM crm.contacts
WHERE organization_id = $1
ORDER BY updated_at DESC
LIMIT 20 OFFSET 0;

-- Contact search by email (used in deduplication, delivery suppression check)
EXPLAIN ANALYZE
SELECT * FROM crm.contacts
WHERE organization_id = $1 AND email = $2;

-- Segment membership evaluation (dynamic segments)
EXPLAIN ANALYZE
SELECT c.* FROM crm.contacts c
WHERE c.organization_id = $1
  AND c.status = 'active'
  AND c.custom_fields->>'city' = 'New York';
```

### Delivery Domain

```sql
-- Suppression list check (every outbound email)
EXPLAIN ANALYZE
SELECT id FROM delivery.suppressions
WHERE organization_id = $1 AND email = $2
LIMIT 1;

-- Daily send count for warmup limit check
EXPLAIN ANALYZE
SELECT count(*)::int FROM delivery.delivery_events
WHERE organization_id = $1
  AND channel = 'email'
  AND event_type = 'sent'
  AND created_at >= $2;
```

### Analytics Domain

```sql
-- Hourly event aggregation (scheduled job)
EXPLAIN ANALYZE
SELECT organization_id, event_type, count(*)::int, count(DISTINCT contact_id)::int
FROM analytics.contact_activity
WHERE created_at >= $1
GROUP BY organization_id, event_type;

-- Campaign performance query
EXPLAIN ANALYZE
SELECT * FROM analytics.campaign_daily_stats
WHERE campaign_id = $1 AND organization_id = $2
ORDER BY date DESC;
```

### Journey Domain

```sql
-- Active execution lookup (used during step processing)
EXPLAIN ANALYZE
SELECT * FROM journey.journey_executions
WHERE id = $1 AND organization_id = $2;

-- Stale execution cleanup (scheduled job)
EXPLAIN ANALYZE
SELECT * FROM journey.journey_executions
WHERE status = 'active' AND started_at < $1;
```

## Database Indexes

### CRM Schema

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `contacts` | `orgEmailIdx` | `(organization_id, email)` | Contact lookup by email within tenant |
| `contacts` | `orgUpdatedIdx` | `(organization_id, updated_at)` | Paginated contact list sorted by recency |
| `companies` | `orgIdx` | `(organization_id)` | Tenant-scoped company listing |
| `segments` | `orgIdx` | `(organization_id)` | Tenant-scoped segment listing |
| `tags` | `orgIdx` | `(organization_id)` | Tenant-scoped tag listing |
| `fields` | `orgEntityIdx` | `(organization_id, entity_type)` | Custom field lookup by entity type |

### Identity Schema

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `users` | unique | `(email)` | User lookup by email (login) |
| `session` | unique | `(token)` | Session validation on every request |
| `organizations` | unique | `(slug)` | Organization lookup by slug |
| `organization_invites` | unique | `(token)` | Invite acceptance token lookup |

### Delivery Schema

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `delivery_jobs` | `orgStatusIdx` | `(organization_id, status)` | Job listing filtered by status |
| `delivery_events` | `jobIdx` | `(job_id)` | Events for a specific job |
| `delivery_events` | `orgIdx` | `(organization_id)` | Tenant-scoped event queries |
| `provider_configs` | `orgChannelIdx` | `(organization_id, channel)` | Provider resolution per tenant per channel |
| `suppressions` | `orgEmailIdx` | `(organization_id, email)` | Suppression check (critical path) |
| `sending_domains` | `orgIdx` | `(organization_id)` | Domain listing per tenant |
| `delivery_jobs` | unique | `(idempotency_key)` | Idempotent delivery job creation |

### Recommended Additional Indexes

```sql
-- Contact activity lookups by contact (analytics timeline)
CREATE INDEX idx_contact_activity_org_contact
ON analytics.contact_activity (organization_id, contact_id, created_at DESC);

-- Campaign daily stats lookup
CREATE INDEX idx_campaign_daily_stats_campaign
ON analytics.campaign_daily_stats (campaign_id, organization_id, date DESC);

-- Journey execution status queries
CREATE INDEX idx_journey_executions_org_status
ON journey.journey_executions (organization_id, status);

-- Delivery events for daily send count (warmup)
CREATE INDEX idx_delivery_events_org_channel_type_date
ON delivery.delivery_events (organization_id, channel, event_type, created_at);

-- GIN index on contact custom_fields for dynamic segment evaluation
CREATE INDEX idx_contacts_custom_fields_gin
ON crm.contacts USING gin (custom_fields jsonb_path_ops);
```

## KV Cache Strategy

Cloudflare Workers KV is used for caching frequently accessed, rarely changing data.

| Cache Key Pattern | Data | TTL | Invalidation |
|---|---|---|---|
| `org:{orgId}` | Organization details (name, slug, planId) | 5 minutes | On org update |
| `plan:{planId}` | Plan details + limits | 1 hour | On plan change (rare) |
| `session:{token}` | Session data (userId, orgId) | 15 minutes | On logout / session revocation |
| `provider:{orgId}:{channel}` | Active provider config (decrypted) | 5 minutes | On provider config change |
| `suppressed:{orgId}:{emailHash}` | Suppression status (boolean) | 10 minutes | On suppression add/remove |
| `usage:{orgId}:{resource}` | Current usage count | 1 minute | On usage increment |
| `template:{orgId}:{templateId}` | Rendered template HTML | 5 minutes | On template update |

### Cache Warming Strategy

- On worker cold start: no proactive warming (lazy population)
- Session cache: populated on first request, subsequent requests use cache
- Provider config: cached on first delivery attempt per org

### Cache Invalidation

- **Write-through**: On mutation operations, delete the affected KV key
- **TTL-based expiry**: All KV entries have short TTLs (1-15 minutes) as a safety net
- **Eventual consistency**: KV is eventually consistent (up to 60s globally); acceptable for our use case

## Connection Pool Settings

### Hyperdrive (Cloudflare Workers -> Neon)

Hyperdrive handles connection pooling transparently for Workers. Configuration in `wrangler.toml`:

```toml
[[hyperdrive]]
binding = "DB"
id = "<hyperdrive-config-id>"
```

Hyperdrive settings (configured via Cloudflare dashboard or API):
- **Max connections per origin**: 10 (default)
- **Caching**: Enabled for read queries (configurable)
- **Origin**: Neon pooler endpoint (`*.neon.tech:5432`)

Recommended Neon pooler settings:
- Use the **pooled connection string** (port 5432 via PgBouncer)
- **Pool mode**: Transaction (default for serverless)
- **Default pool size**: 64 connections per compute endpoint

### Fly.io Services (BullMQ workers -> Neon)

For long-running Fly.io services that use direct connections:

```typescript
// packages/process-lib/src/database/connection.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

// Use Neon's HTTP driver for serverless-compatible pooling
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

Settings:
- **Connection string**: Use Neon pooler endpoint
- **Pool size**: Managed by Neon (no client-side pool needed with HTTP driver)
- **Idle timeout**: N/A (HTTP driver creates no persistent connections)

### Redis (Fly.io services -> Redis)

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  enableReadyCheck: true,
  lazyConnect: true,
});
```

## R2 CDN Cache Headers

For static assets stored in Cloudflare R2 (email images, landing page assets, uploaded files):

```typescript
// Content worker - asset serving
const headers = new Headers({
  'Content-Type': asset.mimeType,
  'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for hashed assets
  'CDN-Cache-Control': 'max-age=86400',                   // 1 day at CDN edge
  'ETag': asset.etag,
  'Vary': 'Accept-Encoding',
});
```

### Cache tiers

| Asset Type | `Cache-Control` | `CDN-Cache-Control` | Notes |
|---|---|---|---|
| Uploaded images/files | `public, max-age=31536000, immutable` | `max-age=86400` | Keyed by content hash |
| Landing page HTML | `public, max-age=300` | `max-age=60` | Short TTL, changes on publish |
| Tracking pixel | `no-cache, no-store` | N/A | Must always hit origin |
| Template previews | `private, no-cache` | N/A | User-specific, never cached |
| API responses | `private, no-store` | N/A | Dynamic data |

## Hyperdrive Connection Pooling Configuration

Create Hyperdrive configurations for each worker that needs database access:

```bash
# Create Hyperdrive configs (one per worker, pointing to same Neon DB)
wrangler hyperdrive create mauntic-identity-db \
  --connection-string="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"

wrangler hyperdrive create mauntic-crm-db \
  --connection-string="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"

wrangler hyperdrive create mauntic-delivery-db \
  --connection-string="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"

# ... repeat for each worker
```

### Hyperdrive Best Practices

1. **Use prepared statements**: Hyperdrive can cache query plans for prepared statements
2. **Keep transactions short**: Long transactions hold connections from the pool
3. **Avoid `SET` commands**: Session-level settings are not preserved across pooled connections
4. **Use read replicas**: For read-heavy queries (analytics), configure Hyperdrive to use Neon read replicas

### Monitoring

- Monitor Hyperdrive connection utilization via Cloudflare dashboard
- Set alerts for connection pool exhaustion (>80% utilization)
- Track query latency via `server-timing` headers Hyperdrive adds
- Monitor Neon compute auto-scaling to ensure endpoints scale with load
