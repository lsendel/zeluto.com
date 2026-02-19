# Architecture Overview

Mauntic3 is a multi-tenant SaaS marketing automation platform built on Cloudflare Workers and Fly.io, using domain-driven design with clearly separated bounded contexts.

## System Diagram

```
                              Internet
                                 |
                    +------------+------------+
                    |    Cloudflare Edge       |
                    |    (CDN + WAF + DNS)     |
                    +------------+------------+
                                 |
                    +------------+------------+
                    |    Gateway Worker        |
                    |  - Rate limiting (DO)    |
                    |  - Auth validation       |
                    |  - CORS / CSRF           |
                    |  - Request routing       |
                    +---+----+----+----+------+
                        |    |    |    |
          +-------------+    |    |    +-------------+
          |                  |    |                  |
    +-----+-----+   +-------+--+ +------+------+   |
    | Identity   |   |   CRM    | |  Content    |   |
    | Worker     |   |  Worker  | |  Worker     |   |
    +-----+------+   +----+----+ +------+------+   |
          |               |             |           |
    +-----+------+  +-----+----+ +-----+------+    |
    | Billing    |  | Campaign | | Delivery   |    |
    | Worker     |  | Worker   | | Worker     |    |
    +-----+------+  +----+----+ +-----+------+    |
          |               |             |           |
    +-----+------+  +-----+----+ +-----+------+    |
    | Journey    |  | Analytics| | Integrations|   |
    | Worker     |  | Worker   | | Worker      |   |
    +------------+  +----------+ +-------------+   |
                                                    |
              +-------------------------------------+
              |
              v
    +-------------------+     +--------------------+
    | Neon Postgres     |     | Cloudflare KV      |
    | (via Hyperdrive)  |     | (Session + Cache)  |
    +-------------------+     +--------------------+

    +-------------------+     +--------------------+
    | Cloudflare R2     |     | Cloudflare Queues  |
    | (Asset Storage)   |     | (Event Bus)        |
    +-------------------+     +--------------------+

              Fly.io (Long-running workers)
    +-------------------+--------------------+--------------------+
    | Journey Executor  | Delivery Engine    | Analytics          |
    | (BullMQ worker)   | (BullMQ worker)    | Aggregator         |
    +---+---------------+---+----------------+---+----------------+
        |                   |                    |
    +---+-------------------+--------------------+---+
    |              Redis (BullMQ queues)              |
    +-------------------------------------------------+
```

## Bounded Contexts

### 1. Identity (Authentication & Authorization)

**Worker**: `mauntic-identity`
**Domain Package**: `@mauntic/identity-domain`
**Responsibilities**:
- User registration, login, session management (via better-auth)
- Organization CRUD (create, update, delete)
- Organization membership and role management (owner, admin, member, viewer)
- Organization invites (create, accept, cancel, resend)
- User profile management and role changes

**Key Entities**: User, Organization, OrganizationMember, OrganizationInvite, Session

### 2. Billing (Subscriptions & Usage)

**Worker**: `mauntic-billing`
**Domain Package**: `@mauntic/billing-domain`
**Responsibilities**:
- Plan definitions with resource limits
- Stripe checkout and subscription lifecycle
- Usage tracking per organization per billing period
- Quota enforcement (checked before resource creation)
- Invoice management

**Key Entities**: Plan, PlanLimit, Subscription, UsageRecord, Invoice

### 3. CRM (Contacts & Companies)

**Worker**: `mauntic-crm`
**Domain Package**: `@mauntic/crm-domain`
**Responsibilities**:
- Contact CRUD with custom fields (JSONB)
- Company management
- Segment management (static and dynamic)
- Tag management
- Custom field definitions
- Contact import/export
- Contact merging
- Contact activity timeline

**Key Entities**: Contact, Company, Segment, Tag, Field

### 4. Content (Templates, Forms & Landing Pages)

**Worker**: `mauntic-content`
**Domain Package**: `@mauntic/content-domain`
**Responsibilities**:
- Email/SMS/push template management with versioning
- Form builder with field definitions
- Form submission processing
- Landing page management with slug-based routing
- Asset management (R2 storage)
- Template preview and rendering

**Key Entities**: Template, TemplateVersion, Form, FormSubmission, LandingPage, Asset

### 5. Campaign (Batch Sends)

**Worker**: `mauntic-campaign`
**Domain Package**: `@mauntic/campaign-domain`
**Responsibilities**:
- Campaign creation and lifecycle (draft, scheduled, sending, sent)
- Campaign versioning
- A/B test management
- Campaign scheduling and sending triggers
- Campaign statistics aggregation
- Campaign cloning
- HTTP routes delegate to the shared `CampaignApplicationService`, which publishes events through the `CampaignEventPublisher` port to keep invariants inside the domain layer.
- Campaign recipient fan-out runs entirely in background queue batches (`campaign.FanOutBatch`), so Cloudflare Queue `sendBatch` fan-outs handle multi-thousand contact segments without blocking HTTP handlers.
- Denormalized `campaign_summaries` projections (with org/status/name indexes) back the `/campaigns` listings, keeping filters and pagination off the hot `campaigns` table.

**Key Entities**: Campaign, CampaignVersion, CampaignStats, AbTest

### 6. Journey (Automation Flows)

**Worker**: `mauntic-journey`
**Fly.io Service**: `journey-executor`
**Domain Package**: `@mauntic/journey-domain`
**Responsibilities**:
- Journey builder with visual step editor
- Journey versioning and publishing
- Trigger management (segment, event, manual, scheduled)
- Step types: action, condition, delay, split
- Execution tracking per contact
- Step execution with idempotency

**Key Entities**: Journey, JourneyVersion, JourneyStep, JourneyTrigger, JourneyExecution, StepExecution

### 7. Delivery (Message Sending)

**Worker**: `mauntic-delivery`
**Fly.io Service**: `delivery-engine`
**Domain Package**: `@mauntic/delivery-domain`
**Responsibilities**:
- Multi-channel delivery (email, SMS, push, webhook)
- Provider management (SES, SendGrid, Twilio, custom SMTP)
- Suppression list management
- Sending domain verification (DNS records)
- IP warmup tracking
- Delivery event tracking (sent, delivered, bounced, opened, clicked)
- Template rendering with variable substitution

**Key Entities**: DeliveryJob, DeliveryEvent, ProviderConfig, Suppression, SendingDomain

### 8. Analytics (Reporting & Dashboards)

**Worker**: `mauntic-analytics`
**Fly.io Service**: `analytics-aggregator`
**Domain Package**: `@mauntic/analytics-domain`
**Responsibilities**:
- Event aggregation (hourly, daily, monthly)
- Campaign performance metrics
- Journey performance metrics
- Contact activity timeline
- Dashboard widgets
- Custom report builder
- Overview statistics

**Key Entities**: EventAggregate, ContactActivity, CampaignDailyStats, JourneyDailyStats, FunnelReport

### 9. Integrations (Third-Party Connections)

**Worker**: `mauntic-integrations`
**Domain Package**: `@mauntic/integrations-domain`
**Responsibilities**:
- Third-party connection management (CRM, e-commerce, etc.)
- Data sync jobs (inbound, outbound, bidirectional)
- Outgoing webhook management
- Webhook delivery with retries

**Key Entities**: Connection, SyncJob, Webhook, WebhookDelivery

## Shared Libraries

### `@mauntic/domain-kernel`
Core building blocks for domain-driven design: base entity classes, value objects, invariant violations, and repository interfaces.

### `@mauntic/worker-lib`
Shared middleware and utilities for Cloudflare Workers:
- Error handling middleware
- Logging middleware
- Tenant middleware (org resolution from session)
- CSRF protection
- CORS configuration
- Circuit breaker
- Hyperdrive database connection
- Queue publisher/consumer
- Unit of work (transactions)

### `@mauntic/process-lib`
Shared utilities for Fly.io long-running services:
- BullMQ worker/queue creation
- Redis connection management
- Database connection
- Health check HTTP server
- Scheduled job registration (cron)

### `@mauntic/contracts`
ts-rest API contracts defining all HTTP endpoints with Zod schemas for request/response validation. Shared between workers for type-safe API boundaries.

## Data Flow: Key Operations

### Contact Creation

```
Client -> Gateway -> CRM Worker
                        |
                        +--> Hyperdrive -> Neon (INSERT crm.contacts)
                        +--> Check billing quota (KV cache or billing worker)
                        +--> Publish event to Cloudflare Queue
                                |
                                +--> Analytics Worker (contact_activity)
                                +--> Journey Worker (trigger evaluation)
```

### Campaign Send

```
Client -> Gateway -> Campaign Worker
                        |
                        +--> Create campaign send job
                        +--> Publish campaign.CampaignSent event
                                |
                                v
                       Campaign Queue Consumer
                                |
                                +--> Enqueue campaign.FanOutBatch (cursor=null)
                                       |
                                       v
                           Fan-out processor (Queue)
                                |
                                +--> Fetch segment page (future CRM fetch)
                                +--> publish delivery.SendMessage via queue.sendBatch
                                +--> enqueue next cursor until empty
                                +--> Update campaign & campaign_summaries projections
                                +--> Publish CampaignStarted/Completed events
                                      |
                                      v
                              Delivery Engine (Fly.io)
                                |
                                +--> Check suppression list
                                +--> Check warmup limits
                                +--> Resolve provider config
                                +--> Render template
                                +--> Send via provider (SES/SendGrid/SMTP)
                                +--> Record delivery event
```

### Journey Execution

```
Trigger (segment eval / event / manual)
    |
    v
Journey Worker -> Enqueue (journey:execute-step)
                      |
                      v
              Journey Executor (Fly.io)
                  |
                  +--> Load execution state
                  +--> Execute step logic
                  |     +--> Action: enqueue delivery
                  |     +--> Condition: evaluate expression
                  |     +--> Delay: schedule delayed wake-up
                  |     +--> Split: route to branch
                  +--> Find next step connections
                  +--> Enqueue next step (recursive)
                  +--> Mark execution complete when no more steps
```

## Multi-Tenancy Approach

Mauntic3 uses a **shared database, shared schema** multi-tenancy model with `organization_id` as the tenant discriminator:

1. **Every tenant-scoped table** has an `organization_id UUID NOT NULL` column
2. **Application-level filtering**: All queries include `WHERE organization_id = ?`
3. **Middleware enforcement + cache**: The gateway’s tenant middleware stores the `TenantContext` in a dedicated Durable Object (`TenantContextDurableObject`, 5‑minute TTL) and attaches both `X-Tenant-Context` and `X-Tenant-Context-Key` headers so downstream workers can hydrate from cache without re-reading session data.
4. **RLS policies** (optional): Row-Level Security policies on Postgres provide defense-in-depth
5. **Cross-tenant prevention**: API responses never include `organization_id` in a way that allows enumeration

### Tenant Resolution Flow

```
Request -> Gateway
              |
              +--> Validate JWT / session token
              +--> Extract organizationId from session
              +--> Cache TenantContext in Durable Object + attach X-Tenant-Context & X-Tenant-Context-Key headers
              |
              v
         Backend Worker
              |
              +--> tenantMiddleware reads cache key (fallback to base64 payload)
              +--> All DB queries scoped by organization_id
              +--> Response filtered to tenant data only
```

### Global (non-tenant) Tables

- `identity.users` - Users span organizations
- `identity.sessions` - Sessions reference active org
- `identity.accounts` - OAuth links (user-level)
- `billing.plans` - Plans are system-wide

## Observability & Structured Logging

All Workers share the `loggingMiddleware` from `@mauntic/worker-lib`, which now emits JSON log lines with a consistent envelope:

```json
{
  "level": "info",
  "service": "gateway",
  "event": "request",
  "requestId": "f2a1...",
  "organizationId": "org_123",
  "path": "/api/v1/contacts",
  "statusCode": 200,
  "durationMs": 32,
  "timestamp": "2026-02-19T22:35:12.148Z"
}
```

- `event` defaults to the message name (e.g., `request`, `queue.metric`, `tenant.cache.fallback`) so filters remain stable.
- The middleware automatically attaches `organizationId`, `userId`, and plan data once the tenant context is resolved; downstream code can produce more specific events by calling `logger.child({ event: 'journey.step.executed', journeyId })`.
- Queue consumers and background jobs reuse the same `Logger` interface, so fan-out failures, Durable Object errors, etc., appear in the same stream.

### Workers Analytics Engine dataset

When a Worker sets the binding `LOGS_DATASET` (see `workers/gateway/wrangler.toml` for an example) the middleware mirrors every log entry to the Cloudflare Workers Analytics Engine dataset `mauntic_logs` using the schema:

| Index position | Field |
| --- | --- |
| 0 | `service` |
| 1 | `level` |
| 2 | `event` |
| 3 | `organizationId` (empty string if absent) |
| 4 | `requestId` |

| Metric | Meaning |
| --- | --- |
| `duration_ms` | Request or job duration (0 if not applicable) |

| Blob | Payload |
| --- | --- |
| `payload` | Full JSON entry (same as console log line) |

Create the dataset once via the Cloudflare dashboard (Workers → Analytics Engine) and add the binding to each Worker:

```toml
[[analytics_engine_datasets]]
binding = "LOGS_DATASET"
dataset = "mauntic_logs"
```

During local development the binding is optional; logs continue to stream via `wrangler tail`. In production, Workers Deployments can query `mauntic_logs` to detect spikes (e.g., `event = 'queue.metric' AND status = 'retry'`) without scraping `console.log`.
