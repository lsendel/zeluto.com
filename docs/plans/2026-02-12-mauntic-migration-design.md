# Mauntic3: Full Platform Migration Design

**Date:** 2026-02-12
**Status:** Approved (v2 — expanded with Parcelvoy, BillionMail, Hybrid Architecture)
**Scope:** Full rewrite of Mautic + Parcelvoy journey engine + BillionMail delivery infra → TypeScript/Hono/Cloudflare + Fly.io

---

## 1. Overview

Rewrite the Mautic open-source marketing automation platform from PHP/Symfony to a modern TypeScript stack. Absorb Parcelvoy's multi-channel journey engine and BillionMail's email delivery infrastructure as native bounded contexts. Deploy on a dual-tier architecture: Cloudflare Workers at the edge for API/UI/light processing, Fly.io machines for heavy compute and self-hosted mail infrastructure.

### Target Stack

| Layer | Technology |
|-------|-----------|
| Edge Runtime | Cloudflare Workers |
| Heavy Compute | Fly.io Machines (Node.js + Docker) |
| Framework | Hono |
| API Contracts | ts-rest + Zod |
| Database | Neon Postgres (via Hyperdrive from CF, direct TCP from Fly) |
| ORM | Drizzle |
| Auth | Better Auth (ported from KMT project) |
| Object Storage | Cloudflare R2 |
| Async Jobs (edge) | Cloudflare Queues |
| Async Jobs (heavy) | BullMQ + Redis on Fly.io |
| Frontend | Hono JSX + HTMX (server-rendered) |
| Monorepo | Turborepo + pnpm workspaces |
| Mail Server | Postfix/Dovecot/Rspamd on Fly.io |

### Source References

- Original Mautic: `/Users/lsendel/Projects/mauntic` (PHP 8.2, Symfony 7.4, MySQL, 31 bundles)
- Auth reference: `/Users/lsendel/Projects/knowledge-management-tool` (Better Auth, Hono, ts-rest, Drizzle, CF Workers)
- Journey engine reference: [Parcelvoy](https://github.com/parcelvoy/platform) (TypeScript, MySQL, Redis, multi-channel orchestration)
- Mail infra reference: [BillionMail](https://github.com/Billionmail/BillionMail) (Go, Postfix/Dovecot/Rspamd, Docker)

---

## 2. Architecture: Dual-Tier Contract-First Micro-Services

### 2.1 Approach

Define all ts-rest contracts upfront across bounded contexts. Each bounded context has its domain logic extracted into a shared package (`packages/domains/<name>-domain/`). Domain packages are deployment-agnostic — the same code runs on CF Workers (light ops) or Fly.io (heavy ops) with different entry points.

A Gateway Worker handles auth, routing, and HTMX page composition. Domain Workers communicate via Service Bindings (sync) and Cloudflare Queues (async). Heavy workloads offload to Fly.io machines via HTTP or shared queues.

### 2.2 Bounded Contexts (10 Contexts)

| Context | Sources | Responsibility | Edge (CF Workers) | Heavy (Fly.io) |
|---------|---------|---------------|-------------------|-----------------|
| **Gateway** | Mautic Core | UI shell, routing, HTMX composition, auth proxy | Yes | -- |
| **Identity** | Mautic User + KMT | Users, auth, roles, permissions, organizations | Yes | -- |
| **CRM** | Mautic Lead/Company/Stage | Contacts, companies, segments, fields, tags | Yes | -- |
| **Journey** | **Parcelvoy** (absorbed) | Multi-channel journey builder, triggers, splits, delays | API + UI | **Execution engine** |
| **Campaign** | Mautic Campaign/Point | Simple blast campaigns, scheduling, point system | Yes | -- |
| **Delivery** | **Parcelvoy providers + BillionMail** (absorbed) | Provider-agnostic message delivery, tracking, suppression | API + light sends | **Bulk send engine** |
| **Content** | Mautic Form/Page/Asset | Forms, landing pages, assets, dynamic content | Yes | -- |
| **Analytics** | Mautic Report/Dashboard | Reports, dashboard widgets, event aggregation | API + UI | **Heavy aggregations** |
| **Integrations** | Mautic + Parcelvoy | Webhooks, third-party CRM sync, Segment/PostHog | Yes | -- |
| **Mail Infra** | **BillionMail** (absorbed) | Self-hosted SMTP (Postfix/Dovecot/Rspamd), deliverability | -- | **Fly.io only** |

### 2.3 Dual-Tier Deployment

```
                         +---------------------------------------------+
                         |            CLOUDFLARE EDGE                   |
                         |                                              |
   Users --> DNS -->     |  +----------+   Service    +--------------+  |
                         |  | Gateway  |--Bindings-->| Identity     |  |
                         |  | Worker   |             | CRM          |  |
                         |  | (auth,   |             | Campaign     |  |
                         |  |  UI,     |             | Content      |  |
                         |  |  proxy)  |             | Integrations |  |
                         |  +----+-----+             +------+-------+  |
                         |       |                          |          |
                         |       |   +-Journey Worker (light ops)      |
                         |       |   +-Delivery Worker (light ops)     |
                         |       |   +-Analytics Worker (light ops)    |
                         |       |                                     |
                         |  R2, KV, Queues, Hyperdrive --> Neon PG     |
                         +-------+-----+-------------------------------+
                                 |     |
                          CF Queues / HTTP (Fly internal)
                                 |     |
                         +-------v-----v-------------------------------+
                         |             FLY.IO MACHINES                  |
                         |                                              |
                         |  +-----------------+  +-------------------+  |
                         |  | Journey         |  | Delivery Engine   |  |
                         |  | Executor        |  | (bulk sends,      |  |
                         |  | (BullMQ,        |  |  throttling,      |  |
                         |  |  delays,        |  |  provider routing)|  |
                         |  |  splits)        |  |                   |  |
                         |  +-----------------+  +--------+----------+  |
                         |                                |             |
                         |  +-----------------+  +--------v----------+  |
                         |  | Analytics       |  | Mail Infra        |  |
                         |  | Aggregator      |  | (Postfix/Dovecot/ |  |
                         |  | (heavy SQL)     |  |  Rspamd)          |  |
                         |  +-----------------+  +-------------------+  |
                         |                                              |
                         |  Redis (BullMQ, caching, rate limiting)      |
                         |  Neon Postgres (direct TCP connection)       |
                         +----------------------------------------------+
```

### 2.4 Cross-Context Communication

| Direction | Method | Example |
|-----------|--------|---------|
| Gateway --> Domain Worker | CF Service Bindings (sync) | Gateway proxies API request to CRM Worker |
| Domain Worker --> Domain Worker | CF Queues (async events) | CRM publishes ContactCreated, Campaign consumes it |
| CF Worker --> Fly.io | HTTP (Fly internal network) | Journey Worker triggers execution on Fly.io Journey Executor |
| Fly.io --> CF Queue | Cloudflare Queue API (HTTP) | Delivery Engine publishes EmailSent event |
| Fly.io --> Neon Postgres | Direct TCP connection | Analytics Aggregator runs heavy SQL |
| CF Worker --> Neon Postgres | Hyperdrive (HTTP driver) | Standard CRUD via Drizzle |
| Delivery Engine --> Mail Infra | SMTP (internal network) | Sends email through Postfix |
| Fly.io services --> Redis | Direct TCP (Fly internal) | BullMQ job queues, rate limiting, journey delays |

---

## 3. Monorepo Structure

```
mauntic3/
+-- packages/
|   +-- contracts/                 # All ts-rest API contracts
|   |   +-- src/
|   |   |   +-- identity.contract.ts
|   |   |   +-- crm.contract.ts
|   |   |   +-- journey.contract.ts
|   |   |   +-- campaign.contract.ts
|   |   |   +-- delivery.contract.ts
|   |   |   +-- content.contract.ts
|   |   |   +-- analytics.contract.ts
|   |   |   +-- integrations.contract.ts
|   |   |   +-- index.ts
|   |   +-- package.json
|   |
|   +-- domain-kernel/             # Shared value objects, events, interfaces
|   |   +-- src/
|   |   |   +-- value-objects/     # ContactId, EmailAddress, etc.
|   |   |   +-- events/           # All domain event types
|   |   |   +-- delivery/         # DeliveryProvider interface, channel types
|   |   |   +-- types/            # Shared enums, branded types
|   |   +-- package.json
|   |
|   +-- domains/                   # Pure domain + application layers (deployment-agnostic)
|   |   +-- identity-domain/
|   |   +-- crm-domain/
|   |   +-- journey-domain/
|   |   +-- campaign-domain/
|   |   +-- delivery-domain/
|   |   +-- content-domain/
|   |   +-- analytics-domain/
|   |   +-- integrations-domain/
|   |   (each contains: entities/, value-objects/, events/,
|   |    repositories/, services/, commands/, queries/, event-handlers/)
|   |
|   +-- worker-lib/                # Shared CF Worker middleware
|   |   +-- src/
|   |   |   +-- middleware/        # Logging, error handling, tracing, CORS
|   |   |   +-- hyperdrive/       # Drizzle + Hyperdrive setup
|   |   |   +-- queue/            # CF Queue publisher/consumer utilities
|   |   +-- package.json
|   |
|   +-- process-lib/               # Shared Fly.io process utilities
|   |   +-- src/
|   |   |   +-- bullmq/           # BullMQ job queue helpers
|   |   |   +-- redis/            # Redis connection management
|   |   |   +-- scheduler/        # Cron/scheduled job utilities
|   |   |   +-- health/           # Health check endpoints
|   |   +-- package.json
|   |
|   +-- ui-kit/                    # Shared HTMX components, CSS, layouts
|       +-- src/
|       |   +-- layouts/           # Base HTML shell, nav, sidebar
|       |   +-- components/        # Reusable JSX components
|       |   +-- styles/            # Tailwind/CSS
|       +-- package.json
|
+-- workers/                       # Cloudflare Workers (edge tier)
|   +-- gateway/                   # Imports: worker-lib, ui-kit, contracts
|   +-- identity/                  # Imports: worker-lib, identity-domain, contracts
|   +-- crm/                       # Imports: worker-lib, crm-domain, contracts, ui-kit
|   +-- journey/                   # Imports: worker-lib, journey-domain, contracts, ui-kit
|   +-- campaign/                  # Imports: worker-lib, campaign-domain, contracts
|   +-- delivery/                  # Imports: worker-lib, delivery-domain, contracts
|   +-- content/                   # Imports: worker-lib, content-domain, contracts, ui-kit
|   +-- analytics/                 # Imports: worker-lib, analytics-domain, contracts, ui-kit
|   +-- integrations/              # Imports: worker-lib, integrations-domain, contracts
|   (each Worker contains: infrastructure/, interface/, drizzle/, wrangler.toml)
|
+-- services/                      # Fly.io services (heavy compute tier)
|   +-- journey-executor/          # Imports: process-lib, journey-domain
|   |   +-- src/worker.ts          # BullMQ worker process
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- delivery-engine/           # Imports: process-lib, delivery-domain
|   |   +-- src/
|   |   |   +-- worker.ts          # BullMQ worker for sends
|   |   |   +-- providers/         # Provider adapter implementations
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- analytics-aggregator/      # Imports: process-lib, analytics-domain
|   |   +-- src/worker.ts
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- mail-infra/                # Self-hosted SMTP server
|   |   +-- docker/
|   |   |   +-- postfix/           # Postfix config
|   |   |   +-- dovecot/           # Dovecot config
|   |   |   +-- rspamd/            # Rspamd config
|   |   +-- src/                   # Sidecar API (domain verification, warmup, webhooks)
|   |   +-- docker-compose.yml
|   |   +-- fly.toml
|   +-- redis/                     # Fly.io Redis (or Upstash)
|       +-- fly.toml
|
+-- turbo.json
+-- package.json
+-- pnpm-workspace.yaml
+-- tsconfig.base.json
```

---

## 4. DDD Architecture

### 4.1 Domain Package Structure (per context)

Each `packages/domains/<name>-domain/` package is pure TypeScript with zero deployment dependencies:

```
packages/domains/journey-domain/
+-- src/
|   +-- entities/
|   |   +-- journey.ts             # Journey aggregate root
|   |   +-- journey-step.ts        # Step entity (action, delay, split, exit)
|   |   +-- journey-execution.ts   # Execution aggregate root
|   |   +-- journey-version.ts     # Immutable journey version
|   +-- value-objects/
|   |   +-- step-config.ts         # Step-specific configs (email, sms, delay, etc.)
|   |   +-- trigger-config.ts      # Event, segment, API trigger configs
|   +-- events/
|   |   +-- journey-published.ts
|   |   +-- step-executed.ts
|   |   +-- journey-completed.ts
|   +-- repositories/              # Port interfaces
|   |   +-- journey.repository.ts
|   |   +-- execution.repository.ts
|   +-- services/
|   |   +-- step-executor.ts       # Domain service: evaluates step logic
|   |   +-- split-evaluator.ts     # Evaluates split conditions
|   +-- commands/
|   |   +-- create-journey.command.ts
|   |   +-- publish-journey.command.ts
|   |   +-- execute-step.command.ts
|   +-- queries/
|   |   +-- list-journeys.query.ts
|   |   +-- get-execution-status.query.ts
|   +-- event-handlers/
|       +-- on-contact-created.ts   # Start journey for new contacts
+-- package.json
+-- tsconfig.json
```

### 4.2 Worker Structure (CF Workers entry point)

Each Worker in `workers/` provides CF-specific infrastructure and interface layers:

```
workers/journey/
+-- src/
|   +-- infrastructure/            # CF-specific implementations
|   |   +-- repositories/          # Drizzle repos (Hyperdrive)
|   |   +-- queue/                 # CF Queue publishers
|   |   +-- flyio/                 # HTTP client to Fly.io executor
|   +-- interface/
|   |   +-- api/                   # ts-rest route handlers (/api/journey/*)
|   |   +-- ui/                    # HTMX partials (/ui/journey/*)
|   |   +-- queue/                 # CF Queue consumers
|   +-- drizzle/
|   |   +-- schema.ts
|   |   +-- migrations/
|   +-- app.ts
|   +-- index.ts                   # CF Worker entry point
+-- wrangler.toml
+-- package.json
```

### 4.3 Service Structure (Fly.io entry point)

Each service in `services/` provides Fly.io-specific infrastructure:

```
services/journey-executor/
+-- src/
|   +-- infrastructure/            # Fly.io-specific implementations
|   |   +-- repositories/          # Drizzle repos (direct TCP to Neon)
|   |   +-- bullmq/               # BullMQ job processors
|   |   +-- redis/                 # Redis for delays, rate limits
|   +-- worker.ts                  # BullMQ worker entry point
+-- Dockerfile
+-- fly.toml
+-- package.json
```

### 4.4 Dependency Rules

1. `packages/domains/*` has ZERO imports from workers/, services/, or any deployment framework
2. `packages/domains/*` may import from `packages/domain-kernel/` (shared value objects, event types)
3. `workers/*` imports from `packages/domains/*` for business logic + `packages/worker-lib/` for CF infra
4. `services/*` imports from `packages/domains/*` for business logic + `packages/process-lib/` for Fly infra
5. Dependencies flow inward: `interface/` --> `application/` --> `domain/` <-- `infrastructure/`
6. Cross-context communication is ONLY via events (Queues) or explicit API calls — never direct imports

---

## 5. Journey Context (Absorbed from Parcelvoy)

### 5.1 Domain Model

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| **Journey** | Journey, JourneyVersion, JourneyStep, JourneyTrigger | Define multi-step flows, version on publish |
| **JourneyExecution** | Execution, StepExecution, ExecutionLog | Track contact progress through a journey |

### 5.2 Journey Versioning

- Editing a journey creates a draft
- Publishing creates an immutable JourneyVersion
- New executions use the latest published version
- In-flight executions complete on their original version
- Old versions are retained for auditing

### 5.3 Step Types

| Category | Step Type | Description |
|----------|-----------|-------------|
| Action | `action_email` | Send email via Delivery context |
| Action | `action_sms` | Send SMS via Delivery context |
| Action | `action_push` | Send push notification via Delivery context |
| Action | `action_webhook` | Fire webhook via Integrations context |
| Action | `action_update_contact` | Update contact field via CRM context |
| Delay | `delay_duration` | Wait X hours/days |
| Delay | `delay_until` | Wait until specific date/time |
| Delay | `delay_event` | Wait until event occurs |
| Control | `split_random` | A/B split (configurable percentages) |
| Control | `split_conditional` | If/else based on contact data |
| Control | `gate` | Wait for condition, then proceed or exit |
| Terminal | `exit` | Remove from journey |

### 5.4 Execution Flow

```
Trigger fires (event/segment/API)
    |
    v
CF Worker: Journey Worker receives trigger
    |
    v
CF Worker: Creates JourneyExecution record in DB
    |
    v
CF Worker: Publishes "ExecuteNextStep" to CF Queue
    |
    v
CF Queue --> Fly.io: Journey Executor picks up job (via HTTP bridge or direct BullMQ)
    |
    +-- ActionStep? --> Publishes SendMessage to Delivery Queue --> next step
    +-- DelayStep?  --> Schedules wake-up in Redis (BullMQ delayed job) --> waits
    +-- SplitStep?  --> Evaluates condition, picks branch --> next step
    +-- GateStep?   --> Registers listener in Redis --> waits for event
    +-- ExitStep?   --> Marks execution complete, publishes JourneyCompleted
```

### 5.5 Why Fly.io for Execution

- Delays can be hours/days — needs persistent scheduled jobs (BullMQ + Redis)
- Segment evaluation for triggers can scan millions of contacts — heavy SQL
- Concurrent executions for bulk campaign sends — needs sustained CPU
- CF Workers have 10ms/50ms CPU limit — not enough for these workloads

---

## 6. Delivery Context (Absorbed from BillionMail + Parcelvoy Providers)

### 6.1 Domain Model

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| **DeliveryJob** | DeliveryJob, DeliveryAttempt | Track each message delivery with retries |
| **ProviderConfig** | ProviderConfig, ProviderCredential | Store provider credentials per channel |
| **Template** | EmailTemplate, SmsTemplate, PushTemplate | Message templates with variable interpolation |
| **TrackingEvent** | Open, Click, Bounce, Unsubscribe, Complaint | Inbound tracking events from providers |
| **SuppressionList** | SuppressionEntry | Global suppression (bounces, complaints, unsubs) |
| **WarmupSchedule** | WarmupSchedule, WarmupDay | IP/domain warmup progression |

### 6.2 Provider Adapter Pattern

```typescript
interface DeliveryProvider<TChannel extends Channel> {
  channel: TChannel;
  name: string;
  send(payload: ChannelPayload<TChannel>): Promise<DeliveryResult>;
  checkStatus?(externalId: string): Promise<DeliveryStatus>;
  handleWebhook?(request: Request): Promise<TrackingEvent[]>;
}
```

### 6.3 Built-in Provider Adapters

| Channel | Provider | Adapter | Tier |
|---------|----------|---------|------|
| Email | Amazon SES | `SesEmailProvider` | CF Worker |
| Email | SendGrid | `SendGridEmailProvider` | CF Worker |
| Email | Mailgun | `MailgunEmailProvider` | CF Worker |
| Email | SMTP (generic) | `SmtpEmailProvider` | Fly.io |
| Email | Self-hosted (Postfix) | `PostfixEmailProvider` | Fly.io |
| SMS | Twilio | `TwilioSmsProvider` | CF Worker |
| SMS | Plivo | `PlivoSmsProvider` | CF Worker |
| SMS | Vonage/Nexmo | `VonageSmsProvider` | CF Worker |
| SMS | Telnyx | `TelnyxSmsProvider` | CF Worker |
| Push | Firebase (FCM) | `FcmPushProvider` | CF Worker |
| Push | Apple (APN) | `ApnPushProvider` | CF Worker |

### 6.4 Suppression Lists

Global suppression list checked before every send:
- Hard bounces: permanently suppressed
- Complaints (spam reports): permanently suppressed
- Unsubscribes: per-channel suppression
- Manual suppressions: admin-managed
- Checked at Delivery context level, before provider.send()

### 6.5 Domain/IP Warmup

- New sending domains/IPs start with low daily limits
- WarmupSchedule defines daily volume ramp (e.g., 50 -> 100 -> 200 -> 500 -> 1000 -> ...)
- Delivery Engine checks warmup limits before sending
- Excess volume queued for next day or routed to warmed-up provider
- Supports multiple IPs per domain with rotation

### 6.6 Bulk Send Engine (Fly.io)

For large campaigns (10k+ recipients):
1. Receives batch job from Queue
2. Splits into chunks (100 per batch)
3. Checks suppression list
4. Checks warmup limits
5. Applies per-provider rate limits
6. Sends via provider adapter
7. Handles retries with exponential backoff
8. Reports progress via domain events

---

## 7. Mail Infrastructure (Absorbed from BillionMail)

### 7.1 Fly.io Deployment

Dedicated Fly.io machine running Docker containers:

```
Fly.io Machine: mauntic-mail-infra
+-- Postfix (SMTP server, port 25/587)
|   +-- DKIM signing
|   +-- SPF validation
|   +-- TLS encryption
|   +-- Rate limiting per IP
+-- Dovecot (IMAP, port 993) -- for bounce processing
+-- Rspamd (spam scoring, DMARC)
+-- Node.js sidecar API
    +-- DNS record management
    +-- Domain verification
    +-- Warmup scheduler integration
    +-- Webhook sender (delivery events --> Delivery Worker)
    +-- Multi-IP management and rotation
```

### 7.2 Integration

Mail Infra is just another DeliveryProvider adapter. The Delivery Engine on Fly.io calls it via internal network:

```typescript
class PostfixEmailProvider implements DeliveryProvider<'email'> {
  async send(payload: EmailPayload): Promise<DeliveryResult> {
    return fetch('http://mauntic-mail-infra.internal:3000/api/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(r => r.json());
  }
}
```

### 7.3 Multi-IP Support

- Multiple sending IPs assignable per domain
- Round-robin or weighted rotation
- Per-IP warmup tracking
- Per-IP reputation monitoring
- Auto-failover to backup IP on delivery issues

---

## 8. API Design

### 8.1 Route Separation

- `/api/*` -- JSON API endpoints (ts-rest contracts)
- `/ui/*` -- HTMX partial endpoints (JSX server-rendered HTML)
- `/api/auth/*` -- Identity/auth endpoints (Better Auth)

### 8.2 ts-rest Contracts

```typescript
export const contract = c.router({
  identity:     identityContract,
  crm:          crmContract,
  journey:      journeyContract,      // NEW
  campaign:     campaignContract,
  delivery:     deliveryContract,      // NEW
  content:      contentContract,
  analytics:    analyticsContract,
  integrations: integrationsContract,
});
```

### 8.3 Gateway Routing

Gateway Worker receives all requests and routes via Service Bindings:
- Auth middleware validates session before proxying
- `/api/<context>/*` --> proxied to corresponding domain Worker
- `/ui/<context>/*` --> proxied to corresponding domain Worker
- `/app/*` --> Gateway serves HTMX page shell, loads partials from `/ui/*`

---

## 9. Database Strategy

### 9.1 Postgres Schemas

Single Neon Postgres database with separate Postgres schemas per bounded context:

| Context | Schema | Key Tables |
|---------|--------|------------|
| Identity | `identity` | users, sessions, accounts, organizations, org_members, verification |
| CRM | `crm` | contacts, companies, segments, segment_filters, fields, field_values, tags, do_not_contact, stages, categories, contact_notes, audit_log |
| Journey | `journey` | journeys, journey_versions, journey_steps, journey_triggers, journey_executions, step_executions, execution_logs |
| Campaign | `campaign` | campaigns, campaign_sends, points, point_triggers |
| Delivery | `delivery` | delivery_jobs, delivery_attempts, provider_configs, email_templates, sms_templates, push_templates, tracking_events, suppression_list, warmup_schedules, warmup_days, sending_ips |
| Content | `content` | forms, form_fields, form_submissions, pages, page_hits, assets, asset_downloads, dynamic_content |
| Analytics | `analytics` | reports, report_schedules, dashboard_widgets, event_aggregates |
| Integrations | `integrations` | integrations, configs, webhooks, webhook_logs, sync_jobs, sync_mappings |

### 9.2 Cross-Context References

- Contexts reference other context entities by ID only (no foreign keys across schemas)
- Data consistency maintained via domain events, not database constraints
- Each deployment's Drizzle config sets `search_path` to its own schema

### 9.3 Migrations

- Domain packages define the schema (`packages/domains/<name>-domain/drizzle/schema.ts`)
- Workers and services reference the same schema
- Root script orchestrates running all migrations in dependency order
- Drizzle Kit for migration generation and execution

---

## 10. Authentication (from KMT)

### 10.1 Approach

Port Better Auth implementation from KMT project:
- Session-based auth with HTTP-only cookies
- OAuth providers: Google, GitHub (configurable)
- Database-backed sessions in `identity.sessions` table
- Multi-tenant: Organizations with role-based membership (owner, admin, member, viewer)
- User/organization blocking

### 10.2 Auth Flow

1. Gateway receives request
2. Auth middleware calls Identity Worker via Service Binding
3. Identity Worker validates session cookie
4. Returns user object (or null for public routes)
5. Gateway passes user context when proxying to domain Workers
6. Domain Workers trust user context from Gateway (Service Binding = trusted)

---

## 11. Cloudflare Infrastructure

### 11.1 Per-Worker Resources

| Worker | R2 | Queues (Produce) | Queues (Consume) | KV | Hyperdrive |
|--------|----|-----------------|------------------|----|-----------|
| Gateway | -- | -- | -- | Session cache | -- |
| Identity | Avatars | user-events | -- | Rate limiting | Neon (identity) |
| CRM | -- | crm-events | journey-events | Segment cache | Neon (crm) |
| Journey | -- | journey-events | crm-events, delivery-events | -- | Neon (journey) |
| Campaign | -- | campaign-events | crm-events | -- | Neon (campaign) |
| Delivery | Email assets | delivery-events | journey-events, campaign-events | Throttle state | Neon (delivery) |
| Content | Assets, images | content-events | -- | Page cache | Neon (content) |
| Analytics | Reports | -- | All event queues | Dashboard cache | Neon (analytics) |
| Integrations | -- | webhook-dispatch | All event queues | API keys | Neon (integrations) |

### 11.2 Fly.io Resources

| Service | Redis | Neon (TCP) | Internal Network | Volumes |
|---------|-------|-----------|------------------|---------|
| Journey Executor | BullMQ queues, delay scheduling | Yes | -- | -- |
| Delivery Engine | Rate limiting, provider state | Yes | Mail Infra (SMTP) | -- |
| Analytics Aggregator | Query caching | Yes | -- | -- |
| Mail Infra | -- | -- | Delivery Engine | Mail queue, logs |
| Redis | -- | -- | All services | Data volume |

---

## 12. Domain Model Summary

### 12.1 CRM Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Contact | Create, update, merge, track activity, manage consent |
| Company | Create, link to contacts |
| Segment | Define filters, rebuild membership (async) |
| Stage | Pipeline stages for contacts |

Events: ContactCreated, ContactUpdated, ContactMerged, SegmentRebuilt

### 12.2 Journey Context (from Parcelvoy)

| Aggregate | Key Behaviors |
|-----------|---------------|
| Journey | Define multi-step flows, version on publish |
| JourneyExecution | Track contact progress, execute steps |

Events: JourneyPublished, StepExecuted, JourneyCompleted

### 12.3 Campaign Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Campaign | Blast sends, scheduling, audience selection |
| PointScheme | Award/deduct points, trigger actions |

Events: CampaignSent, PointsAwarded

### 12.4 Delivery Context (from BillionMail + Parcelvoy)

| Aggregate | Key Behaviors |
|-----------|---------------|
| DeliveryJob | Route to provider, track attempts, retry |
| ProviderConfig | Configure provider credentials |
| Template | Render templates with contact data |
| SuppressionList | Block sends to bounced/complained/unsubscribed |
| WarmupSchedule | Manage IP/domain warmup progression |

Events: EmailSent, EmailOpened, EmailClicked, EmailBounced, SmsSent

### 12.5 Content Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Form | Build forms, process submissions |
| LandingPage | Create pages, track visits |
| Asset | File management, download tracking |

Events: FormSubmitted, PageVisited, AssetDownloaded

### 12.6 Analytics Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Report | Define queries, schedule generation |
| Widget | Dashboard widget definitions and data |

Consumes: Events from all contexts

### 12.7 Integrations Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Integration | Configure third-party connections |
| Webhook | Dispatch webhooks on events |
| Sync | Bi-directional data sync with CRMs |

Consumes: Events from all contexts

---

## 13. Migration Phasing

### Phase 0: Foundation (Week 1-2)
- Set up monorepo (Turborepo, pnpm workspaces, tsconfig)
- Create shared packages (contracts, domain-kernel, worker-lib, process-lib, ui-kit)
- Create domain packages structure (packages/domains/*)
- Set up Gateway Worker with Better Auth (port from KMT)
- Set up Neon Postgres with Hyperdrive bindings
- Create Postgres schemas for all contexts
- Set up Fly.io project with Redis
- CI/CD pipeline (GitHub Actions --> Wrangler deploy + Fly deploy)

### Phase 1: Define All Contracts (Week 2-4)
- Map all endpoints to ts-rest contracts (including journey + delivery)
- Define all Zod schemas for request/response types
- Define all domain events in domain-kernel
- Define DeliveryProvider interface and channel types
- Blueprint only -- no implementation

### Phase 2: Identity Context (Week 4-5)
- Port auth from KMT to Identity Worker
- Users, roles, permissions, organizations
- Better Auth + Drizzle on identity schema
- Gateway <--> Identity Service Binding

### Phase 3: CRM Context (Week 5-8)
- Contact, Company, Segment, Field, Tag aggregates
- Full DDD in packages/domains/crm-domain/ + workers/crm/
- HTMX UI for contact management
- Queue publishers for CRM events

### Phase 4: Delivery Context (Week 8-11)
- Provider adapter pattern in packages/domains/delivery-domain/
- SES + Twilio + Firebase adapters (CF Worker)
- SMTP adapter (Fly.io)
- Template rendering engine
- Tracking webhook handlers (opens, clicks, bounces)
- Suppression list management
- services/delivery-engine/ on Fly.io for bulk sends

### Phase 5: Journey Context (Week 11-14)
- Journey builder in packages/domains/journey-domain/
- Step types: action, delay, split, gate, exit
- Journey versioning
- workers/journey/ for API + UI
- services/journey-executor/ on Fly.io (BullMQ + Redis)
- Multi-channel orchestration (email --> wait --> SMS --> push)

### Phase 6: Campaign Context (Week 14-15)
- Simple blast campaigns, scheduling
- Point system
- Uses Delivery context for actual sending

### Phase 7: Content Context (Week 15-17)
- Form builder + submission processing
- Landing page builder
- Asset management (R2)
- Dynamic content engine

### Phase 8: Analytics & Integrations (Week 17-20)
- Reporting engine + dashboard widgets
- services/analytics-aggregator/ on Fly.io for heavy queries
- Webhook dispatch
- Third-party CRM sync (Salesforce, HubSpot patterns)
- Segment/PostHog integration

### Phase 9: Mail Infrastructure (Week 20-22)
- services/mail-infra/ on Fly.io
- Postfix/Dovecot/Rspamd setup
- Domain verification and DNS management API
- IP/domain warmup scheduler
- Multi-IP rotation and management
- PostfixEmailProvider adapter in Delivery context

### Phase 10: Polish & Migration (Week 22-24)
- Data migration scripts (Mautic MySQL --> Neon Postgres)
- End-to-end testing
- Performance optimization
- Documentation and deployment guide
