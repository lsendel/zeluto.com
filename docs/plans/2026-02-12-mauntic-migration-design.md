# Mauntic3: Full Platform Migration Design

**Date:** 2026-02-12
**Status:** Approved (v3 — SaaS multi-tenancy, audit fixes, DDD hardening)
**Scope:** Full rewrite of Mautic + Parcelvoy journey engine + BillionMail delivery infra → TypeScript/Hono/Cloudflare + Fly.io, multi-tenant SaaS for marketing organizations

> **Note:** References to `docker-compose.dev.yml` in this document reflect the original 2026 migration plan. The current developer workflow connects directly to the shared Neon branch and no longer requires Docker.

---

## 1. Overview

Rewrite the Mautic open-source marketing automation platform from PHP/Symfony to a modern TypeScript stack. Absorb Parcelvoy's multi-channel journey engine and BillionMail's email delivery infrastructure as native bounded contexts. Deploy on a dual-tier architecture: Cloudflare Workers at the edge for API/UI/light processing, Fly.io machines for heavy compute and self-hosted mail infrastructure. Designed as a multi-tenant SaaS platform where each marketing organization operates in full isolation.

### Target Stack

| Layer | Technology |
|-------|-----------|
| Edge Runtime | Cloudflare Workers |
| Heavy Compute | Fly.io Machines (Node.js + Docker) |
| Framework | Hono |
| API Contracts | ts-rest + Zod |
| Database | Neon Postgres (via Hyperdrive from CF, pooler from Fly) |
| ORM | Drizzle |
| Auth | Better Auth (ported from KMT project) |
| Billing | Stripe (subscriptions, usage metering, invoices) |
| Object Storage | Cloudflare R2 |
| Async Jobs (edge) | Cloudflare Queues |
| Async Jobs (heavy) | BullMQ + Redis on Fly.io |
| Frontend | Hono JSX + HTMX (server-rendered) |
| Monorepo | Turborepo + pnpm workspaces |
| Mail Server | Postfix/Dovecot/Rspamd on Fly.io |
| Observability | Structured logging (pino) + OpenTelemetry traces |

### Source References

- Original Mautic: `/Users/lsendel/Projects/mauntic` (PHP 8.2, Symfony 7.4, MySQL, 31 bundles)
- Auth reference: `/Users/lsendel/Projects/knowledge-management-tool` (Better Auth, Hono, ts-rest, Drizzle, CF Workers, Stripe)
- Journey engine reference: [Parcelvoy](https://github.com/parcelvoy/platform) (TypeScript, MySQL, Redis, multi-channel orchestration)
- Mail infra reference: [BillionMail](https://github.com/Billionmail/BillionMail) (Go, Postfix/Dovecot/Rspamd, Docker)

---

## 2. Architecture: Dual-Tier Contract-First Micro-Services

### 2.1 Approach

Define all ts-rest contracts upfront across bounded contexts. Each bounded context has its domain logic extracted into a shared package (`packages/domains/<name>-domain/`). Domain packages are deployment-agnostic — the same code runs on CF Workers (light ops) or Fly.io (heavy ops) with different entry points.

A Gateway Worker handles auth, routing, HTMX page composition, and tenant context extraction. Domain Workers communicate via Service Bindings (sync) and Cloudflare Queues (async). Heavy workloads offload to Fly.io machines via HTTP or shared queues. Every request carries an `organizationId` extracted from the authenticated session — all data access is scoped to the tenant.

### 2.2 Bounded Contexts (11 Contexts)

| Context | Sources | Responsibility | Edge (CF Workers) | Heavy (Fly.io) |
|---------|---------|---------------|-------------------|-----------------|
| **Gateway** | Mautic Core | UI shell, routing, HTMX composition, auth proxy, tenant context | Yes | -- |
| **Identity** | Mautic User + KMT | Users, auth, roles, permissions, organizations, invites | Yes | -- |
| **Billing** | KMT Stripe (NEW) | Subscriptions, plans, usage metering, invoices, quotas | Yes | -- |
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
                         |  | Worker   |             | Billing      |  |
                         |  | (auth,   |             | CRM          |  |
                         |  |  tenant, |             | Campaign     |  |
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
                         |  Neon Postgres (pooler connection)           |
                         +----------------------------------------------+
```

### 2.4 Cross-Context Communication

| Direction | Method | Example |
|-----------|--------|---------|
| Gateway --> Domain Worker | CF Service Bindings (sync) | Gateway proxies API request to CRM Worker |
| Domain Worker --> Domain Worker | CF Queues (async events) | CRM publishes ContactCreated, Campaign consumes it |
| CF Worker --> Fly.io | HTTP (Fly internal network) | Journey Worker triggers execution on Fly.io Journey Executor |
| Fly.io --> CF Queue | Cloudflare Queue API (HTTP) | Delivery Engine publishes EmailSent event |
| Fly.io --> Neon Postgres | Neon pooler (TCP) | Analytics Aggregator runs heavy SQL |
| CF Worker --> Neon Postgres | Hyperdrive (HTTP driver) | Standard CRUD via Drizzle |
| Delivery Engine --> Mail Infra | SMTP (internal network) | Sends email through Postfix |
| Fly.io services --> Redis | Direct TCP (Fly internal) | BullMQ job queues, rate limiting, journey delays |

---

## 3. Multi-Tenant SaaS Architecture

### 3.1 Tenant Model

Every marketing organization is an `Organization` in the Identity context. All data across all contexts is scoped by `organizationId`.

```
Organization (Identity context)
├── Members (users with roles: owner, admin, member, viewer)
├── Subscription (Billing context: plan, quotas, usage)
├── Provider Configs (Delivery: org-specific SES/Twilio/etc. keys)
├── Sending Domains (Delivery: org-specific verified domains)
├── Contacts, Segments, etc. (CRM)
├── Journeys (Journey)
├── Campaigns (Campaign)
├── Forms, Pages, Assets (Content)
└── Integrations, Webhooks (Integrations)
```

### 3.2 Tenant Isolation Strategy

**Row-level isolation with Postgres RLS as defense-in-depth:**

1. Every table (except Identity core tables) has an `organization_id` column
2. Gateway middleware extracts `organizationId` from the authenticated user's session
3. Tenant context is propagated to all downstream Workers via Service Binding headers and Queue message metadata
4. Repository layer always includes `WHERE organization_id = ?` (application-level enforcement)
5. Postgres Row-Level Security (RLS) policies as a safety net — even if application code has a bug, Postgres blocks cross-tenant access

```sql
-- Example RLS policy (applied per schema)
ALTER TABLE crm.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm.contacts
  USING (organization_id = current_setting('app.organization_id')::int);
```

Each request sets `SET LOCAL app.organization_id = <id>` within its transaction.

### 3.3 Tenant Context Propagation

```typescript
// In domain-kernel
export interface TenantContext {
  organizationId: number;
  userId: number;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}

// Gateway extracts from session, passes via:
// - Service Binding: X-Tenant-Context header (JSON)
// - CF Queue: message metadata.tenantContext
// - Fly.io HTTP: X-Tenant-Context header (JSON)
// - BullMQ: job.data.tenantContext
```

All command/query handlers receive `TenantContext` as a required parameter. Repositories inject `organizationId` into every query.

### 3.4 SaaS Plans & Quotas

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Contacts | 500 | 5,000 | 50,000 | Unlimited |
| Emails/month | 1,000 | 10,000 | 100,000 | Unlimited |
| SMS/month | 0 | 500 | 5,000 | Unlimited |
| Journeys | 2 | 10 | 50 | Unlimited |
| Team members | 1 | 5 | 20 | Unlimited |
| Custom domains | 0 | 1 | 5 | Unlimited |
| Self-hosted SMTP | No | No | Yes | Yes |
| API access | No | Yes | Yes | Yes |
| Custom branding | No | No | Yes | Yes |
| SSO (SAML) | No | No | No | Yes |

Quotas are enforced at the application layer via the Billing context. Before resource-consuming operations (send email, create contact, etc.), the command handler calls `BillingService.checkQuota(orgId, resource, amount)`.

### 3.5 Per-Organization Configuration

Each organization configures independently:

- **Delivery providers**: Own API keys for SES, SendGrid, Twilio, etc.
- **Sending domains**: Verified domains with DKIM/SPF/DMARC
- **Sending IPs**: Dedicated or shared pool (Pro+ plans)
- **Branding**: Logo, color scheme, sender name, email footer
- **Webhooks**: Custom webhook endpoints for events
- **Integrations**: Salesforce, HubSpot, Segment connections
- **Suppression lists**: Per-org bounce/complaint/unsubscribe lists

### 3.6 Onboarding Flow

1. User signs up (creates User in Identity)
2. Creates Organization (or accepts invite to existing)
3. Billing: Starts on Free plan (no credit card required)
4. Guided setup: Add sending domain → Verify DNS → Configure provider → Import contacts
5. Upgrade prompt when approaching quota limits

---

## 4. Monorepo Structure

```
mauntic3/
+-- packages/
|   +-- contracts/                 # All ts-rest API contracts
|   |   +-- src/
|   |   |   +-- identity.contract.ts
|   |   |   +-- billing.contract.ts   # NEW
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
|   +-- domain-kernel/             # Shared value objects, events, interfaces, errors
|   |   +-- src/
|   |   |   +-- value-objects/     # ContactId, EmailAddress, etc.
|   |   |   +-- events/           # All domain event types (versioned)
|   |   |   +-- delivery/         # DeliveryProvider interface, channel types
|   |   |   +-- errors/           # DomainError hierarchy (NEW)
|   |   |   +-- tenant/           # TenantContext, quota types (NEW)
|   |   |   +-- types/            # Shared enums, branded types
|   |   +-- package.json
|   |
|   +-- domains/                   # Pure domain + application layers (deployment-agnostic)
|   |   +-- identity-domain/
|   |   +-- billing-domain/        # NEW
|   |   +-- crm-domain/
|   |   +-- journey-domain/
|   |   +-- campaign-domain/
|   |   +-- delivery-domain/
|   |   |   +-- src/
|   |   |   |   +-- providers/     # HTTP-based provider adapters (SES, SendGrid, Twilio, FCM)
|   |   |   |   +-- ... (standard DDD directories)
|   |   |   +-- drizzle/
|   |   |   |   +-- schema.ts      # Single source of truth for delivery schema
|   |   |   |   +-- migrations/
|   |   +-- content-domain/
|   |   +-- analytics-domain/
|   |   +-- integrations-domain/
|   |   (each contains: entities/, value-objects/, events/,
|   |    repositories/, services/, application/, commands/, queries/,
|   |    event-handlers/, drizzle/)
|   |
|   +-- worker-lib/                # Shared CF Worker middleware
|   |   +-- src/
|   |   |   +-- middleware/        # Logging, error handling, tracing, CORS, CSRF, tenant
|   |   |   +-- hyperdrive/       # Drizzle + Hyperdrive setup
|   |   |   +-- queue/            # CF Queue publisher/consumer with dead letter + idempotency
|   |   |   +-- transaction/      # Transaction wrapper for command handlers
|   |   +-- package.json
|   |
|   +-- process-lib/               # Shared Fly.io process utilities
|   |   +-- src/
|   |   |   +-- bullmq/           # BullMQ job queue helpers with idempotency
|   |   |   +-- redis/            # Redis connection management
|   |   |   +-- scheduler/        # Cron/scheduled job utilities (BullMQ repeatable)
|   |   |   +-- health/           # Health check endpoints
|   |   |   +-- database/         # Neon pooler connection + transaction wrapper
|   |   +-- package.json
|   |
|   +-- ui-kit/                    # Shared HTMX components, CSS, layouts
|       +-- src/
|       |   +-- layouts/           # Base HTML shell, nav, sidebar, onboarding
|       |   +-- components/        # Reusable JSX components
|       |   +-- styles/            # Tailwind CSS
|       +-- package.json
|
+-- workers/                       # Cloudflare Workers (edge tier)
|   +-- gateway/                   # Imports: worker-lib, ui-kit, contracts
|   +-- identity/                  # Imports: worker-lib, identity-domain, contracts
|   +-- billing/                   # Imports: worker-lib, billing-domain, contracts (NEW)
|   +-- crm/                       # Imports: worker-lib, crm-domain, contracts, ui-kit
|   +-- journey/                   # Imports: worker-lib, journey-domain, contracts, ui-kit
|   +-- campaign/                  # Imports: worker-lib, campaign-domain, contracts
|   +-- delivery/                  # Imports: worker-lib, delivery-domain, contracts
|   +-- content/                   # Imports: worker-lib, content-domain, contracts, ui-kit
|   +-- analytics/                 # Imports: worker-lib, analytics-domain, contracts, ui-kit
|   +-- integrations/              # Imports: worker-lib, integrations-domain, contracts
|   (each Worker contains: infrastructure/, interface/, wrangler.toml)
|   (Drizzle schema is IMPORTED from packages/domains/<name>-domain/drizzle/schema.ts)
|
+-- services/                      # Fly.io services (heavy compute tier)
|   +-- journey-executor/          # Imports: process-lib, journey-domain
|   |   +-- src/worker.ts          # BullMQ worker process
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- delivery-engine/           # Imports: process-lib, delivery-domain
|   |   +-- src/
|   |   |   +-- worker.ts          # BullMQ worker for sends
|   |   |   +-- providers/         # TCP-only providers (SMTP, Postfix)
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- analytics-aggregator/      # (Retired Feb 2026 — analytics now runs on Cloudflare Queues)
|   |   +-- src/worker.ts
|   |   +-- Dockerfile
|   |   +-- fly.toml
|   +-- mail-infra/                # Self-hosted SMTP server
|   |   +-- docker/
|   |   |   +-- postfix/           # Postfix config
|   |   |   +-- dovecot/           # Dovecot config
|   |   |   +-- rspamd/            # Rspamd config
|   |   +-- src/                   # Sidecar API
|   |   +-- docker-compose.yml
|   |   +-- fly.toml
|   +-- redis/                     # Fly.io Redis
|       +-- fly.toml
|
+-- scripts/                       # Operational scripts
|   +-- init-schemas.ts            # Creates all Postgres schemas + RLS policies
|   +-- migrate-all.ts             # Runs migrations for all contexts in order
|   +-- seed.ts                    # Development seed data
|
+-- docker-compose.dev.yml         # Local dev: Postgres + Redis
+-- turbo.json
+-- package.json
+-- pnpm-workspace.yaml
+-- tsconfig.base.json
```

---

## 5. DDD Architecture

### 5.1 Domain Package Structure (per context)

Each `packages/domains/<name>-domain/` package is pure TypeScript with zero deployment dependencies:

```
packages/domains/journey-domain/
+-- src/
|   +-- entities/
|   |   +-- journey.ts             # Journey aggregate root (with invariant enforcement)
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
|   +-- repositories/              # Port interfaces (always accept organizationId)
|   |   +-- journey.repository.ts
|   |   +-- execution.repository.ts
|   +-- services/                  # Pure domain logic (no side effects)
|   |   +-- split-evaluator.ts     # Evaluates split conditions
|   |   +-- step-validator.ts      # Validates step configurations
|   +-- application/               # Orchestration layer (has side effects)
|   |   +-- step-executor.ts       # Orchestrates step execution, publishes events
|   |   +-- journey-publisher.ts   # Orchestrates journey publish flow
|   +-- commands/
|   |   +-- create-journey.command.ts
|   |   +-- publish-journey.command.ts
|   |   +-- execute-step.command.ts
|   +-- queries/
|   |   +-- list-journeys.query.ts
|   |   +-- get-execution-status.query.ts
|   +-- event-handlers/            # Includes Anti-Corruption Layer translation
|   |   +-- on-contact-created.ts  # Translates CRM event → Journey command
|   +-- acl/                       # Anti-Corruption Layer adapters
|       +-- crm-translator.ts      # Maps CRM events to Journey domain language
+-- drizzle/                       # Schema owned by this domain (single source of truth)
|   +-- schema.ts
|   +-- migrations/
+-- package.json
+-- tsconfig.json
```

### 5.2 Application Services vs Domain Services

**Domain Services** (`services/`): Pure domain logic. No I/O, no side effects. Example: `SplitEvaluator.evaluate(contact, conditions)` returns a branch ID.

**Application Services** (`application/`): Orchestrate workflows. Can call repositories, publish events, call other context APIs via ports. Example: `StepExecutor.execute(step, execution)` loads data from repo, runs domain logic, publishes events to queue, persists results.

### 5.3 Aggregate Root Invariant Enforcement

Aggregate roots validate their own invariants in constructors and mutation methods:

```typescript
// packages/domains/journey-domain/src/entities/journey.ts
export class Journey {
  private constructor(
    readonly id: JourneyId,
    readonly organizationId: number,
    private _name: string,
    private _status: JourneyStatus,
    private _steps: JourneyStep[],
    private _triggers: JourneyTrigger[],
  ) {}

  static create(orgId: number, name: string): Journey {
    if (!name.trim()) throw new ValidationError('Journey name is required');
    return new Journey(/* ... */);
  }

  publish(): JourneyVersion {
    if (this._steps.length === 0) throw new InvariantViolation('Cannot publish journey with no steps');
    if (this._triggers.length === 0) throw new InvariantViolation('Cannot publish journey with no triggers');
    if (this._status === 'archived') throw new InvariantViolation('Cannot publish archived journey');
    // Create immutable version...
  }
}
```

### 5.4 Anti-Corruption Layer (ACL)

When consuming events from another context, translate into the local domain language:

```typescript
// packages/domains/journey-domain/src/acl/crm-translator.ts
export class CrmTranslator {
  static toJourneyContact(event: ContactCreatedEvent): JourneyContactSnapshot {
    return {
      contactId: event.data.contactId as ContactId,
      // Map CRM fields to what Journey context needs
      // Do NOT expose CRM internals (field names, segment structure)
    };
  }
}

// packages/domains/journey-domain/src/event-handlers/on-contact-created.ts
export class OnContactCreated {
  handle(event: ContactCreatedEvent, ctx: TenantContext): void {
    const contact = CrmTranslator.toJourneyContact(event);
    // Check if any journeys have matching triggers for this org
  }
}
```

### 5.5 DomainError Hierarchy

```typescript
// packages/domain-kernel/src/errors/domain-error.ts
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string | number) {
    super('NOT_FOUND', `${entity} ${id} not found`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class InvariantViolation extends DomainError {
  constructor(message: string) {
    super('INVARIANT_VIOLATION', message, 422);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

export class QuotaExceededError extends DomainError {
  constructor(resource: string, limit: number) {
    super('QUOTA_EXCEEDED', `${resource} quota exceeded (limit: ${limit})`, 402);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}
```

### 5.6 Transaction Boundaries

Every command handler executes within a single database transaction. The transaction wrapper also sets the RLS tenant context:

```typescript
// packages/worker-lib/src/transaction/unit-of-work.ts
export async function withTransaction<T>(
  db: DrizzleInstance,
  tenantContext: TenantContext,
  fn: (tx: DrizzleTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.organization_id = ${tenantContext.organizationId}`);
    return fn(tx);
  });
}
```

### 5.7 Worker Structure (CF Workers entry point)

Each Worker in `workers/` provides CF-specific infrastructure and interface layers:

```
workers/journey/
+-- src/
|   +-- infrastructure/            # CF-specific implementations
|   |   +-- repositories/          # Drizzle repos (Hyperdrive), import schema from domain pkg
|   |   +-- queue/                 # CF Queue publishers
|   |   +-- flyio/                 # HTTP client to Fly.io executor (with circuit breaker)
|   +-- interface/
|   |   +-- api/                   # ts-rest route handlers (/api/journey/*)
|   |   +-- ui/                    # HTMX partials (/ui/journey/*)
|   |   +-- queue/                 # CF Queue consumers (idempotent)
|   +-- app.ts
|   +-- index.ts                   # CF Worker entry point
+-- wrangler.toml
+-- package.json
```

**Key: Workers do NOT contain Drizzle schema files.** They import from `packages/domains/<name>-domain/drizzle/schema.ts`.

### 5.8 Service Structure (Fly.io entry point)

```
services/journey-executor/
+-- src/
|   +-- infrastructure/            # Fly.io-specific implementations
|   |   +-- repositories/          # Drizzle repos (Neon pooler), import schema from domain pkg
|   |   +-- bullmq/               # BullMQ job processors (idempotent)
|   |   +-- redis/                 # Redis for delays, rate limits
|   +-- worker.ts                  # BullMQ worker entry point
+-- Dockerfile
+-- fly.toml
+-- package.json
```

### 5.9 Dependency Rules

1. `packages/domains/*` has ZERO imports from workers/, services/, or any deployment framework
2. `packages/domains/*` may import from `packages/domain-kernel/` (shared value objects, event types, errors)
3. `packages/domains/*` owns its own Drizzle schema in `drizzle/schema.ts`
4. `workers/*` imports from `packages/domains/*` for business logic + schema + `packages/worker-lib/` for CF infra
5. `services/*` imports from `packages/domains/*` for business logic + schema + `packages/process-lib/` for Fly infra
6. Dependencies flow inward: `interface/` → `application/` → `domain/` ← `infrastructure/`
7. Cross-context communication is ONLY via events (Queues) or explicit API calls — never direct imports
8. All repository interfaces accept `organizationId` as a required parameter
9. HTTP-based provider adapters (SES, SendGrid, Twilio, FCM) live in `packages/domains/delivery-domain/src/providers/`
10. TCP-only provider adapters (SMTP, Postfix) live in `services/delivery-engine/src/providers/`

---

## 6. Journey Context (Absorbed from Parcelvoy)

### 6.1 Domain Model

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| **Journey** | Journey, JourneyVersion, JourneyStep, JourneyTrigger | Define multi-step flows, version on publish, enforce invariants |
| **JourneyExecution** | Execution, StepExecution, ExecutionLog | Track contact progress through a journey |

All aggregates scoped by `organizationId`.

### 6.2 Journey Versioning

- Editing a journey creates a draft
- Publishing creates an immutable JourneyVersion
- New executions use the latest published version
- In-flight executions complete on their original version
- Old versions are retained for auditing
- Invariant: Cannot publish with zero steps or zero triggers

### 6.3 Step Types

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

### 6.4 Execution Flow

```
Trigger fires (event/segment/API)
    |
    v
CF Worker: Journey Worker receives trigger
    |
    v
Billing: checkQuota(orgId, 'journeys')  <-- quota enforcement
    |
    v
CF Worker: Creates JourneyExecution record in DB (idempotency key)
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

### 6.5 Why Fly.io for Execution

- Delays can be hours/days — needs persistent scheduled jobs (BullMQ + Redis)
- Segment evaluation for triggers can scan millions of contacts — heavy SQL
- Concurrent executions for bulk campaign sends — needs sustained CPU
- CF Workers have 10ms/50ms CPU limit — not enough for these workloads

---

## 7. Delivery Context (Absorbed from BillionMail + Parcelvoy Providers)

### 7.1 Domain Model

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| **DeliveryJob** | DeliveryJob, DeliveryAttempt | Track each message delivery with retries, idempotency key |
| **ProviderConfig** | ProviderConfig, ProviderCredential | Per-org provider credentials per channel |
| **Template** | EmailTemplate, SmsTemplate, PushTemplate | Per-org message templates with variable interpolation |
| **TrackingEvent** | Open, Click, Bounce, Unsubscribe, Complaint | Inbound tracking events from providers |
| **SuppressionList** | SuppressionEntry | Per-org suppression (bounces, complaints, unsubs) |
| **WarmupSchedule** | WarmupSchedule, WarmupDay | Per-org IP/domain warmup progression |

All aggregates scoped by `organizationId`.

### 7.2 Provider Adapter Pattern

```typescript
interface DeliveryProvider<TChannel extends Channel> {
  channel: TChannel;
  name: string;
  send(payload: ChannelPayload<TChannel>): Promise<DeliveryResult>;
  checkStatus?(externalId: string): Promise<DeliveryStatus>;
  handleWebhook?(request: Request): Promise<TrackingEvent[]>;
}
```

**Provider placement:**
- HTTP-based providers (SES, SendGrid, Twilio, FCM, APN) → `packages/domains/delivery-domain/src/providers/` (can run on CF Workers or Fly.io)
- TCP-only providers (SMTP, Postfix) → `services/delivery-engine/src/providers/` (Fly.io only)

### 7.3 Built-in Provider Adapters

| Channel | Provider | Adapter | Location |
|---------|----------|---------|----------|
| Email | Amazon SES | `SesEmailProvider` | delivery-domain (HTTP) |
| Email | SendGrid | `SendGridEmailProvider` | delivery-domain (HTTP) |
| Email | Mailgun | `MailgunEmailProvider` | delivery-domain (HTTP) |
| Email | SMTP (generic) | `SmtpEmailProvider` | delivery-engine (TCP) |
| Email | Self-hosted (Postfix) | `PostfixEmailProvider` | delivery-engine (TCP) |
| SMS | Twilio | `TwilioSmsProvider` | delivery-domain (HTTP) |
| SMS | Plivo | `PlivoSmsProvider` | delivery-domain (HTTP) |
| SMS | Vonage/Nexmo | `VonageSmsProvider` | delivery-domain (HTTP) |
| SMS | Telnyx | `TelnyxSmsProvider` | delivery-domain (HTTP) |
| Push | Firebase (FCM) | `FcmPushProvider` | delivery-domain (HTTP) |
| Push | Apple (APN) | `ApnPushProvider` | delivery-domain (HTTP) |

### 7.4 Suppression Lists (per-org)

Per-organization suppression list checked before every send:
- Hard bounces: permanently suppressed
- Complaints (spam reports): permanently suppressed
- Unsubscribes: per-channel suppression
- Manual suppressions: admin-managed
- Checked at Delivery context level, before provider.send()
- Cross-checked against global suppression (platform-level blocks)

### 7.5 Domain/IP Warmup

- New sending domains/IPs start with low daily limits
- WarmupSchedule defines daily volume ramp (e.g., 50 → 100 → 200 → 500 → 1000 → ...)
- Delivery Engine checks warmup limits before sending
- Excess volume queued for next day or routed to warmed-up provider
- Supports multiple IPs per domain with rotation
- Per-IP warmup tracking, per-IP reputation monitoring

### 7.6 Bulk Send Engine (Fly.io)

For large campaigns (10k+ recipients):
1. Receives batch job from Queue (with idempotency key)
2. Splits into chunks (100 per batch)
3. Checks suppression list (per-org)
4. Checks warmup limits (per-org)
5. Applies per-provider rate limits
6. Checks org quota via Billing context
7. Sends via provider adapter
8. Handles retries with exponential backoff
9. Reports progress via domain events

### 7.7 Idempotency

Every DeliveryJob has a unique `idempotencyKey` (hash of: orgId + contactId + templateId + campaignId/journeyExecutionId + timestamp-bucket). Before processing, check Redis for existing key. This prevents double-sends on queue retry.

---

## 8. Mail Infrastructure (Absorbed from BillionMail)

### 8.1 Fly.io Deployment

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
    +-- Domain verification (per-org)
    +-- Warmup scheduler integration
    +-- Webhook sender (delivery events --> Delivery Worker)
    +-- Multi-IP management and rotation
```

### 8.2 Integration

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

### 8.3 Multi-IP Support

- Multiple sending IPs assignable per org/domain
- Round-robin or weighted rotation
- Per-IP warmup tracking
- Per-IP reputation monitoring
- Auto-failover to backup IP on delivery issues

---

## 9. Billing Context (NEW)

### 9.1 Domain Model

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| **Subscription** | Subscription, SubscriptionItem | Stripe subscription lifecycle, plan changes |
| **UsageRecord** | UsageRecord | Track per-org resource consumption (contacts, sends, etc.) |
| **Invoice** | Invoice, InvoiceItem | Stripe invoice sync, payment status |
| **Plan** | Plan, PlanLimit | Define plan tiers with quota limits |

### 9.2 Quota Enforcement

```typescript
// packages/domains/billing-domain/src/services/quota-checker.ts
export class QuotaChecker {
  async checkQuota(
    orgId: number,
    resource: QuotaResource,
    amount: number = 1,
  ): Promise<void> {
    const usage = await this.usageRepo.getCurrentUsage(orgId, resource);
    const limit = await this.planRepo.getLimit(orgId, resource);
    if (limit !== -1 && usage + amount > limit) {
      throw new QuotaExceededError(resource, limit);
    }
  }
}

export type QuotaResource =
  | 'contacts'
  | 'emails_per_month'
  | 'sms_per_month'
  | 'push_per_month'
  | 'journeys'
  | 'team_members'
  | 'custom_domains'
  | 'api_requests_per_day';
```

### 9.3 Usage Metering

Usage is tracked in real-time via domain events:
- `EmailSent` → increment `emails_per_month` counter
- `ContactCreated` → increment `contacts` counter
- Monthly reset via scheduled job (BullMQ repeatable on Fly.io)

### 9.4 Stripe Integration

- Subscription management: create, upgrade, downgrade, cancel
- Webhook handling: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`
- Usage-based billing for Enterprise plans (Stripe metered billing)
- Free tier: no credit card required
- Trial period: 14 days of Pro features for new orgs

---

## 10. API Design

### 10.1 Route Separation

- `/api/*` — JSON API endpoints (ts-rest contracts)
- `/ui/*` — HTMX partial endpoints (JSX server-rendered HTML)
- `/api/auth/*` — Identity/auth endpoints (Better Auth)
- `/api/billing/*` — Subscription/plan endpoints (Stripe)
- `/api/delivery/tracking/*` — Provider webhook callbacks (public, HMAC-verified)

### 10.2 API Versioning

URL-based versioning: `/api/v1/<context>/*`. The `v1` prefix is embedded in ts-rest contract paths. When breaking changes are needed, add `/api/v2/` contracts alongside v1. Old versions are maintained for 6 months.

### 10.3 ts-rest Contracts

```typescript
export const contract = c.router({
  identity:     identityContract,
  billing:      billingContract,      // NEW
  crm:          crmContract,
  journey:      journeyContract,
  campaign:     campaignContract,
  delivery:     deliveryContract,
  content:      contentContract,
  analytics:    analyticsContract,
  integrations: integrationsContract,
});
```

### 10.4 Gateway Routing

Gateway Worker receives all requests and routes via Service Bindings:
- Auth middleware validates session before proxying
- Tenant middleware extracts organizationId from session, sets X-Tenant-Context header
- CSRF middleware validates token on mutating requests
- `/api/<context>/*` → proxied to corresponding domain Worker
- `/ui/<context>/*` → proxied to corresponding domain Worker
- `/app/*` → Gateway serves HTMX page shell, loads partials from `/ui/*`

### 10.5 Rate Limiting

API rate limits enforced at Gateway using CF KV:

| Plan | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Starter | 300 | 50 |
| Pro | 1,000 | 100 |
| Enterprise | 5,000 | 500 |

---

## 11. Database Strategy

### 11.1 Postgres Schemas

Single Neon Postgres database with separate Postgres schemas per bounded context. Every table (except Identity core) includes `organization_id`:

| Context | Schema | Key Tables |
|---------|--------|------------|
| Identity | `identity` | users, sessions, accounts, organizations, org_members, org_invites, verification |
| Billing | `billing` | subscriptions, usage_records, invoices, plans, plan_limits |
| CRM | `crm` | contacts, companies, segments, segment_filters, fields, field_values, tags, do_not_contact, stages, categories, contact_notes, audit_log |
| Journey | `journey` | journeys, journey_versions, journey_steps, journey_triggers, journey_executions, step_executions, execution_logs |
| Campaign | `campaign` | campaigns, campaign_sends, points, point_triggers |
| Delivery | `delivery` | delivery_jobs, delivery_attempts, provider_configs, email_templates, sms_templates, push_templates, tracking_events, suppression_list, warmup_schedules, warmup_days, sending_ips |
| Content | `content` | forms, form_fields, form_submissions, pages, page_hits, assets, asset_downloads, dynamic_content |
| Analytics | `analytics` | reports, report_schedules, dashboard_widgets, event_aggregates, materialized_summaries |
| Integrations | `integrations` | integrations, configs, webhooks, webhook_logs, sync_jobs, sync_mappings |

### 11.2 Schema Initialization

A root script creates all schemas and RLS policies before any context migrations run:

```sql
-- scripts/init-schemas.ts generates and runs:
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS journey;
CREATE SCHEMA IF NOT EXISTS campaign;
CREATE SCHEMA IF NOT EXISTS delivery;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS integrations;

-- RLS policies on every non-identity schema
ALTER TABLE crm.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm.contacts
  USING (organization_id = current_setting('app.organization_id')::int);
-- (repeated for all tables in all schemas)
```

### 11.3 Cross-Context References

- Contexts reference other context entities by ID only (no foreign keys across schemas)
- Data consistency maintained via domain events, not database constraints
- Each deployment's Drizzle config sets `search_path` to its own schema

### 11.4 Schema Ownership

**Single source of truth:** Each domain package owns its schema at `packages/domains/<name>-domain/drizzle/schema.ts`. Workers and services import from there. Migrations are also generated from this location.

### 11.5 Indexing Strategy

Critical indexes for performance (defined in schema files):

```typescript
// CRM indexes
index('idx_contacts_org_email').on(contacts.organizationId, contacts.email),
index('idx_contacts_org_updated').on(contacts.organizationId, contacts.updatedAt),

// Delivery indexes
index('idx_delivery_jobs_org_status').on(deliveryJobs.organizationId, deliveryJobs.status),
index('idx_delivery_jobs_idempotency').on(deliveryJobs.idempotencyKey).unique(),
index('idx_tracking_events_job').on(trackingEvents.deliveryJobId),
index('idx_suppression_org_email').on(suppressionList.organizationId, suppressionList.email),

// Journey indexes
index('idx_executions_org_status').on(journeyExecutions.organizationId, journeyExecutions.status),
index('idx_executions_journey_contact').on(journeyExecutions.journeyId, journeyExecutions.contactId),
```

### 11.6 Connection Pooling

- **CF Workers → Neon:** Via Hyperdrive (managed connection pool)
- **Fly.io → Neon:** Via Neon's built-in connection pooler endpoint (`-pooler.` hostname, PgBouncer mode)
- Each Fly.io service uses a pool of 10-20 connections

### 11.7 Analytics Pre-Aggregation

Heavy analytics queries use materialized views and pre-computed aggregates:

```sql
-- analytics.event_aggregates: pre-computed hourly rollups
-- Populated by Analytics Aggregator on Fly.io (BullMQ scheduled job, hourly)
CREATE TABLE analytics.event_aggregates (
  organization_id int NOT NULL,
  event_type text NOT NULL,
  hour timestamptz NOT NULL,
  count bigint NOT NULL,
  metadata jsonb,
  PRIMARY KEY (organization_id, event_type, hour)
);
```

### 11.8 Migrations

- Domain packages define the schema (`packages/domains/<name>-domain/drizzle/schema.ts`)
- Workers and services reference the same schema
- `scripts/migrate-all.ts` orchestrates running all migrations in dependency order
- Drizzle Kit for migration generation and execution

---

## 12. Authentication & Authorization (from KMT)

### 12.1 Approach

Port Better Auth implementation from KMT project:
- Session-based auth with HTTP-only cookies
- OAuth providers: Google, GitHub (configurable per deployment)
- Database-backed sessions in `identity.sessions` table
- Per-request auth instance (required for CF Workers — no long-lived processes)
- Multi-tenant: Organizations with role-based membership (owner, admin, member, viewer)
- User/organization blocking

### 12.2 Auth Flow with Tenant Context

1. Gateway receives request
2. Auth middleware calls Identity Worker via Service Binding
3. Identity Worker validates session cookie (Better Auth `getSession()`)
4. Returns user object with active organization membership
5. Gateway extracts `TenantContext { organizationId, userId, userRole, plan }`
6. Gateway passes `TenantContext` when proxying to domain Workers (X-Tenant-Context header)
7. Domain Workers trust `TenantContext` from Gateway (Service Binding = trusted)

### 12.3 Organization Switching

Users can belong to multiple organizations. Active org is stored in session or selected via header. Switching org updates the tenant context for subsequent requests.

### 12.4 Role-Based Access Control

| Role | Permissions |
|------|------------|
| Owner | Full access, manage billing, delete org, manage members |
| Admin | Full access except billing and org deletion |
| Member | Create/edit own resources, view shared resources |
| Viewer | Read-only access to all resources |

Permission checks happen in the interface layer (API route handlers), before calling application services.

---

## 13. Cloudflare Infrastructure

### 13.1 Per-Worker Resources

| Worker | R2 | Queues (Produce) | Queues (Consume) | KV | Hyperdrive |
|--------|----|-----------------|------------------|----|-----------|
| Gateway | -- | -- | -- | Session cache, Rate limits, CSRF tokens | -- |
| Identity | Avatars | user-events | -- | Rate limiting | Neon (identity) |
| Billing | -- | billing-events | user-events | Plan cache | Neon (billing) |
| CRM | -- | crm-events | journey-events | Segment cache | Neon (crm) |
| Journey | -- | journey-events | crm-events, delivery-events | -- | Neon (journey) |
| Campaign | -- | campaign-events | crm-events | -- | Neon (campaign) |
| Delivery | Email assets | delivery-events | journey-events, campaign-events | Throttle state | Neon (delivery) |
| Content | Assets, images | content-events | -- | Page cache | Neon (content) |
| Analytics | Reports | -- | All event queues | Dashboard cache | Neon (analytics) |
| Integrations | -- | webhook-dispatch | All event queues | API keys | Neon (integrations) |

### 13.2 Queue Configuration

All queues configured with dead letter queues (DLQ) for failed messages:

```toml
# wrangler.toml example
[[queues.consumers]]
queue = "crm-events"
max_retries = 3
dead_letter_queue = "crm-events-dlq"
```

### 13.3 Fly.io Resources

| Service | Redis | Neon (pooler) | Internal Network | Volumes |
|---------|-------|-----------|------------------|---------|
| Journey Executor | BullMQ queues, delay scheduling | Yes | -- | -- |
| Delivery Engine | Rate limiting, idempotency keys, provider state | Yes | Mail Infra (SMTP) | -- |
| Analytics Aggregator | Query caching | Yes | -- | -- |
| Mail Infra | -- | -- | Delivery Engine | Mail queue, logs |
| Redis | -- | -- | All services | Data volume |

---

## 14. Domain Model Summary

### 14.1 Identity Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| User | Create, authenticate, block/unblock, manage profile |
| Organization | Create, invite members, manage roles, switch active org |

Events: UserCreated, OrgCreated, MemberInvited, MemberJoined, MemberRemoved, RoleChanged

### 14.2 Billing Context (NEW)

| Aggregate | Key Behaviors |
|-----------|---------------|
| Subscription | Create (Stripe), upgrade, downgrade, cancel, renew |
| UsageRecord | Track resource consumption, reset monthly |
| Plan | Define tier limits, enforce quotas |

Events: SubscriptionCreated, PlanUpgraded, PlanDowngraded, QuotaWarning, QuotaExceeded, PaymentFailed

### 14.3 CRM Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Contact | Create, update, merge, track activity, manage consent |
| Company | Create, link to contacts |
| Segment | Define filters, rebuild membership (async) |
| Stage | Pipeline stages for contacts |

Events: ContactCreated, ContactUpdated, ContactMerged, SegmentRebuilt

### 14.4 Journey Context (from Parcelvoy)

| Aggregate | Key Behaviors |
|-----------|---------------|
| Journey | Define multi-step flows, version on publish, enforce invariants |
| JourneyExecution | Track contact progress, execute steps |

Events: JourneyPublished, StepExecuted, JourneyCompleted

### 14.5 Campaign Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Campaign | Blast sends, scheduling, audience selection |
| PointScheme | Award/deduct points, trigger actions |

Events: CampaignSent, PointsAwarded

### 14.6 Delivery Context (from BillionMail + Parcelvoy)

| Aggregate | Key Behaviors |
|-----------|---------------|
| DeliveryJob | Route to provider, track attempts, retry, idempotency |
| ProviderConfig | Per-org provider credentials |
| Template | Render templates with contact data |
| SuppressionList | Per-org bounce/complaint/unsubscribe blocking |
| WarmupSchedule | Per-org IP/domain warmup progression |

Events: EmailSent, EmailOpened, EmailClicked, EmailBounced, SmsSent

### 14.7 Content Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Form | Build forms, process submissions |
| LandingPage | Create pages, track visits |
| Asset | File management, download tracking |

Events: FormSubmitted, PageVisited, AssetDownloaded

### 14.8 Analytics Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Report | Define queries, schedule generation |
| Widget | Dashboard widget definitions and data |

Consumes: Events from all contexts. Pre-aggregates hourly via scheduled job.

### 14.9 Integrations Context

| Aggregate | Key Behaviors |
|-----------|---------------|
| Integration | Per-org third-party connections |
| Webhook | Dispatch webhooks on events (with retry) |
| Sync | Bi-directional data sync with CRMs |

Consumes: Events from all contexts

---

## 15. Error Handling Strategy

### 15.1 Error Flow

```
Domain Error (thrown in domain/application layer)
    |
    v
Infrastructure catches (Worker/Service error handler middleware)
    |
    +-- DomainError? --> Map to HTTP status code (from error.statusCode)
    +-- Unexpected? --> Log full trace, return 500 with correlation ID
    +-- Queue message? --> Retry up to 3x, then dead letter queue
```

### 15.2 Dead Letter Queues

Every CF Queue has a corresponding DLQ. Failed messages (after 3 retries) go to DLQ. A monitoring dashboard alerts on DLQ depth. DLQ messages can be replayed manually.

### 15.3 Circuit Breaker (CF Worker → Fly.io)

When CF Workers call Fly.io services via HTTP, a circuit breaker prevents cascading failures:

```typescript
// packages/worker-lib/src/middleware/circuit-breaker.ts
// States: CLOSED (normal) → OPEN (failing, reject all) → HALF_OPEN (test one request)
// Tracked in KV per service endpoint
// Threshold: 5 failures in 60 seconds → OPEN for 30 seconds
```

### 15.4 Webhook Retry

Outbound webhooks (Integrations context) use exponential backoff: 1min, 5min, 30min, 2hr, 12hr. After 5 failures, webhook is disabled and org admin notified.

---

## 16. Observability

### 16.1 Structured Logging

All Workers and services use pino for structured JSON logging:

```typescript
import pino from 'pino';
const logger = pino({
  level: 'info',
  base: { service: 'crm-worker', version: '0.0.1' },
});
// Middleware adds: requestId, organizationId, userId to every log line
```

### 16.2 Distributed Tracing

Correlation IDs propagated through the entire request chain:
- Gateway generates `X-Request-Id` header
- Passed to Service Bindings, Queue messages, Fly.io HTTP calls, BullMQ jobs
- Domain event metadata includes `correlationId` (already defined in domain-kernel)
- Enables tracing a user action through Gateway → CRM Worker → Queue → Journey Executor → Delivery Engine

### 16.3 Metrics

Key metrics collected via Cloudflare Analytics and custom counters:
- Request rate / latency / error rate per Worker
- Queue depth and processing latency
- Delivery success rate per provider per org
- Active journey executions
- Contact count per org
- BullMQ job completion rate

### 16.4 Alerting

- DLQ depth > 0: Alert (Slack/email)
- Error rate > 5%: Alert
- Queue depth growing > 10 min: Alert
- Provider delivery rate < 90%: Alert
- Warmup limit approaching: Notify org admin

---

## 17. Security

### 17.1 CSRF Protection

All mutating requests via HTMX require a CSRF token:
- Gateway generates a per-session CSRF token (stored in KV, sent as cookie)
- HTMX includes token in `X-CSRF-Token` header (configured via `hx-headers`)
- Gateway middleware validates token on POST/PUT/PATCH/DELETE
- API requests authenticated via session cookie also require CSRF
- API requests authenticated via API key (Enterprise plan) are exempt

### 17.2 XSS Prevention

- All JSX output auto-escaped by Hono JSX
- Email template content sanitized with DOMPurify before storage
- Landing page HTML sanitized before rendering
- Content-Security-Policy headers on all responses

### 17.3 Secrets Management

Provider API keys (SES, Twilio, etc.) are encrypted at rest:

```typescript
// packages/domains/delivery-domain/src/value-objects/encrypted-config.ts
// Uses AES-256-GCM with a per-deployment encryption key (from env)
// Stored in provider_configs.config as encrypted JSON
// Decrypted only when needed for provider.send()
```

### 17.4 Input Validation

- Zod schemas validate all API input at the boundary (ts-rest)
- Domain entities enforce invariants (inner validation)
- SQL injection prevented by Drizzle (parameterized queries)
- Rate limiting at Gateway prevents abuse

### 17.5 Tenant Isolation Verification

- Application-level: All repository queries include `organizationId`
- Database-level: Postgres RLS policies as defense-in-depth
- Audit: Periodic automated tests verify no cross-tenant data leakage

---

## 18. Event Versioning

### 18.1 Event Envelope

All domain events include a version field in metadata:

```typescript
export interface DomainEventMetadata {
  version: number;          // Event schema version (starts at 1)
  sourceContext: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  tenantContext: {           // Always included for multi-tenant routing
    organizationId: number;
  };
}
```

### 18.2 Evolution Rules

- **Adding fields:** Backward compatible. Consumers ignore unknown fields. Increment version.
- **Removing fields:** NOT allowed. Deprecate and stop populating, but keep the field.
- **Changing types:** NOT allowed. Add a new field with the new type.
- **New event type:** Always safe. Add new type to `AnyDomainEvent` union.

### 18.3 Consumer Compatibility

Queue consumers must handle events at their current version AND all previous versions. Use a version check:

```typescript
function handleContactCreated(event: ContactCreatedEvent) {
  if (event.metadata.version >= 2) {
    // Use new field introduced in v2
  }
  // Base handling works for all versions
}
```

---

## 19. Local Development

### 19.1 docker-compose.dev.yml

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: mauntic_dev
      POSTGRES_USER: mauntic
      POSTGRES_PASSWORD: mauntic
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### 19.2 Local Worker Development

- `wrangler dev` for individual Workers (with `--local` flag for Queues/KV)
- Workers connect to local Postgres (no Hyperdrive in dev — direct connection)
- Fly.io services run locally via `tsx watch` against local Redis + Postgres
- `turbo dev` runs everything in parallel

---

## 20. Migration Phasing

### Phase 0: Foundation (Week 1-3)
- Set up monorepo (Turborepo, pnpm workspaces, tsconfig)
- Create shared packages (contracts, domain-kernel with errors + tenant types, worker-lib with CSRF + circuit breaker, process-lib with idempotency, ui-kit)
- Create domain packages structure (packages/domains/*)
- Set up local dev environment (docker-compose, wrangler dev config)
- Set up Neon Postgres: create schemas, RLS policies, init script
- Set up Gateway Worker with Better Auth (port from KMT) + tenant context extraction
- Set up Hyperdrive bindings + Neon pooler config
- Set up Fly.io project with Redis
- CI/CD pipeline (GitHub Actions → Wrangler deploy + Fly deploy)

### Phase 1: Define All Contracts + Events (Week 3-5)
- Map all endpoints to ts-rest contracts (including journey, delivery, billing)
- Define all Zod schemas for request/response types
- Define all domain events in domain-kernel (with version field)
- Define DeliveryProvider interface and channel types
- Define TenantContext type and quota types
- Add API versioning prefix (/api/v1/)
- Blueprint only — no implementation

### Phase 2: Identity + Billing Context (Week 5-7)
- Port auth from KMT to Identity Worker
- Users, roles, permissions, organizations, invites, org switching
- Better Auth + Drizzle on identity schema
- Billing context: Stripe subscriptions, plans, usage metering
- Quota enforcement service
- Gateway ↔ Identity ↔ Billing Service Bindings
- Onboarding flow (signup → create org → select plan)

### Phase 3: CRM Context (Week 7-10)
- Contact, Company, Segment, Field, Tag aggregates (all org-scoped)
- Full DDD in packages/domains/crm-domain/ + workers/crm/
- HTMX UI for contact management
- Queue publishers for CRM events
- Bulk import with quota checking

### Phase 4: Delivery Context (Week 10-13)
- Provider adapter pattern in packages/domains/delivery-domain/
- HTTP-based adapters in delivery-domain/src/providers/ (SES, SendGrid, Twilio, FCM)
- TCP-based adapters in services/delivery-engine/src/providers/ (SMTP, Postfix)
- Template rendering engine
- Tracking webhook handlers (opens, clicks, bounces)
- Per-org suppression list management
- Idempotency on all delivery jobs
- services/delivery-engine/ on Fly.io for bulk sends

### Phase 5: Journey Context (Week 13-16)
- Journey builder in packages/domains/journey-domain/
- Step types: action, delay, split, gate, exit
- Journey versioning with invariant enforcement
- ACL for CRM events
- workers/journey/ for API + UI
- services/journey-executor/ on Fly.io (BullMQ + Redis)
- Idempotent step execution
- Multi-channel orchestration (email → wait → SMS → push)

### Phase 6: Campaign Context (Week 16-17)
- Simple blast campaigns, scheduling
- Point system
- Uses Delivery context for actual sending
- Quota checks on send

### Phase 7: Content Context (Week 17-19)
- Form builder + submission processing
- Landing page builder (with XSS sanitization)
- Asset management (R2)
- Dynamic content engine

### Phase 8: Analytics & Integrations (Week 19-22)
- Reporting engine + dashboard widgets
- Cloudflare Queue workers for aggregation (replaces the earlier Fly.io analytics-aggregator)
- Pre-aggregation hourly job (materialized summaries)
- Webhook dispatch with retry + exponential backoff
- Third-party CRM sync (Salesforce, HubSpot patterns)
- Segment/PostHog integration

### Phase 9: Mail Infrastructure (Week 22-24)
- services/mail-infra/ on Fly.io
- Postfix/Dovecot/Rspamd setup
- Domain verification and DNS management API
- IP/domain warmup scheduler
- Multi-IP rotation and management
- PostfixEmailProvider adapter in Delivery context

### Phase 10: Observability & Security Hardening (Week 24-25)
- Structured logging (pino) across all Workers and services
- Distributed tracing (correlation ID propagation)
- DLQ monitoring dashboard
- Circuit breaker for Fly.io calls
- Tenant isolation audit (automated cross-tenant tests)
- Performance profiling and query optimization

### Phase 11: Polish & Migration (Week 25-28)
- Data migration scripts (Mautic MySQL → Neon Postgres, including org creation)
- End-to-end testing (journey → delivery → tracking flow)
- Performance optimization (caching, query tuning, connection pooling)
- CI/CD pipeline finalization (staging → production)
- Documentation and deployment guide
