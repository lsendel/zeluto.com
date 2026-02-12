# Mauntic3: Full Platform Migration Design

**Date:** 2026-02-12
**Status:** Approved
**Scope:** Full rewrite of Mautic (PHP/Symfony) to TypeScript/Hono/Cloudflare

---

## 1. Overview

Rewrite the Mautic open-source marketing automation platform from PHP/Symfony to a modern TypeScript stack deployed on Cloudflare infrastructure. The new platform (Mauntic3) uses domain-driven design with micro-Workers per bounded context.

### Target Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| API Contracts | ts-rest + Zod |
| Database | Neon Postgres (via Hyperdrive) |
| ORM | Drizzle |
| Auth | Better Auth (ported from KMT project) |
| Object Storage | Cloudflare R2 |
| Async Jobs | Cloudflare Queues |
| Frontend | Hono JSX + HTMX (server-rendered) |
| Monorepo | Turborepo + pnpm workspaces |

### Source Reference

- Original Mautic: `/Users/lsendel/Projects/mauntic` (PHP 8.2, Symfony 7.4, MySQL, 31 bundles)
- Auth reference: `/Users/lsendel/Projects/knowledge-management-tool` (Better Auth, Hono, ts-rest, Drizzle, Cloudflare Workers)

---

## 2. Architecture: Contract-First Micro-Workers

### 2.1 Approach

Define all ts-rest contracts upfront across bounded contexts. Each bounded context is a separate Cloudflare Worker. A Gateway Worker handles auth, routing, and HTMX page composition. A shared domain kernel package contains shared value objects and domain events.

### 2.2 Bounded Contexts (Workers)

| Worker | Mautic Bundles Covered | Responsibility |
|--------|----------------------|----------------|
| **Gateway** | CoreBundle, DashboardBundle | UI shell, routing, HTMX page composition, auth proxy |
| **Identity** | UserBundle | Users, sessions, roles, permissions, organizations, OAuth, SAML |
| **CRM** | LeadBundle, LeadFieldBundle, CompanyBundle, StageBundle, CategoryBundle | Contacts, companies, segments, fields, tags |
| **Campaign** | CampaignBundle, PointBundle | Campaign builder, execution engine, point system |
| **Messaging** | EmailBundle, SmsBundle, NotificationBundle | Email/SMS/push templates, bulk sending, tracking |
| **Content** | FormBundle, PageBundle, AssetBundle, DynamicContentBundle | Forms, landing pages, assets, dynamic content |
| **Analytics** | ReportBundle, DashboardBundle (widgets) | Reports, dashboard widgets, data aggregation |
| **Integrations** | IntegrationsBundle, WebhookBundle, all plugin bundles | Third-party sync, webhooks, CRM/social integrations |

### 2.3 Cross-Context Communication

```
                    +---------------+
                    |    Gateway    | <-- Auth, UI shell, routing
                    |    Worker     |
                    +-------+-------+
                            | Service Bindings (sync)
           +----------------+----------------+
           |                |                |
     +-----v-----+   +-----v-----+   +-----v-----+
     |  Identity  |   |    CRM    |   | Campaign  |  ...
     |   Worker   |   |   Worker  |   |  Worker   |
     +-----+------+   +-----+-----+   +-----+-----+
           |                |                |
           +----------------+----------------+
                            | Cloudflare Queues (async events)
                    +-------v-------+
                    |   Event Bus   |
                    |   (Queues)    |
                    +---------------+
```

- **Service Bindings:** Synchronous RPC between Workers (Gateway -> domain Workers)
- **Cloudflare Queues:** Async domain events (ContactCreated, EmailSent, etc.)
- **No cross-context database joins** -- only ID references

---

## 3. Monorepo Structure

```
mauntic3/
+-- packages/
|   +-- contracts/              # All ts-rest API contracts (shared)
|   |   +-- src/
|   |   |   +-- identity.contract.ts
|   |   |   +-- crm.contract.ts
|   |   |   +-- campaign.contract.ts
|   |   |   +-- messaging.contract.ts
|   |   |   +-- content.contract.ts
|   |   |   +-- analytics.contract.ts
|   |   |   +-- integrations.contract.ts
|   |   |   +-- index.ts
|   |   +-- package.json
|   |
|   +-- domain-kernel/          # Shared value objects & domain events
|   |   +-- src/
|   |   |   +-- value-objects/  # ContactId, EmailAddress, CampaignId, etc.
|   |   |   +-- events/        # Domain event types
|   |   |   +-- types/         # Shared enums, branded types
|   |   +-- package.json
|   |
|   +-- worker-lib/             # Shared Worker middleware
|   |   +-- src/
|   |   |   +-- middleware/     # Logging, error handling, tracing, CORS, rate limiting
|   |   |   +-- hyperdrive/    # Drizzle + Hyperdrive setup
|   |   |   +-- queue/         # Queue publisher/consumer utilities
|   |   +-- package.json
|   |
|   +-- ui-kit/                 # Shared HTMX components, CSS, layouts
|       +-- src/
|       |   +-- layouts/        # Base HTML shell, nav, sidebar
|       |   +-- components/     # Reusable JSX components (tables, forms, cards)
|       |   +-- styles/         # Tailwind/CSS
|       +-- package.json
|
+-- workers/
|   +-- gateway/                # Auth, routing, HTMX page composition
|   +-- identity/               # Users, auth, roles, organizations
|   +-- crm/                    # Contacts, companies, segments
|   +-- campaign/               # Campaign builder & execution
|   +-- messaging/              # Email, SMS, push sending
|   +-- content/                # Forms, pages, assets
|   +-- analytics/              # Reports, dashboard widgets
|   +-- integrations/           # Webhooks, third-party sync
|
+-- turbo.json
+-- package.json
+-- tsconfig.base.json
```

---

## 4. DDD Internal Architecture (per Worker)

Each domain Worker follows hexagonal architecture:

```
workers/<name>/src/
+-- domain/                    # Pure business logic -- NO framework deps
|   +-- entities/              # Aggregate roots and entities
|   +-- value-objects/         # Context-specific value objects
|   +-- events/                # Domain events this context emits
|   +-- repositories/          # Repository INTERFACES (ports)
|   +-- services/              # Domain services (cross-aggregate logic)
|
+-- application/               # Use cases -- orchestrates domain + infra
|   +-- commands/              # Write operations (CreateContact, etc.)
|   +-- queries/               # Read operations (ListContacts, etc.)
|   +-- event-handlers/        # Handles events from OTHER contexts
|
+-- infrastructure/            # Implementations of ports
|   +-- repositories/          # Drizzle repository implementations
|   +-- queue/                 # Queue publisher implementations
|   +-- services/              # External service adapters
|
+-- interface/                 # Inbound adapters (HTTP, Queue)
|   +-- api/                   # JSON API handlers (ts-rest) at /api/*
|   +-- ui/                    # HTMX partial handlers (JSX) at /ui/*
|   +-- queue/                 # Queue consumer handlers
|
+-- drizzle/
|   +-- schema.ts              # Drizzle table definitions
|   +-- migrations/            # Context-specific migrations
|
+-- app.ts                     # Hono app composition
```

**Dependency rules:**
1. `domain/` has ZERO imports from `infrastructure/` or framework code
2. Repository interfaces defined in `domain/`, implemented in `infrastructure/`
3. `application/` orchestrates: calls domain logic, publishes events, returns DTOs
4. Dependencies flow inward: `interface/` -> `application/` -> `domain/` <- `infrastructure/`

---

## 5. API Design

### 5.1 Route Separation

- `/api/*` -- JSON API endpoints (ts-rest contracts)
- `/ui/*` -- HTMX partial endpoints (JSX server-rendered HTML)
- `/api/auth/*` -- Identity/auth endpoints (Better Auth)

### 5.2 ts-rest Contracts

All contracts defined in `packages/contracts/`. Each context has its own contract file. Root contract composes all sub-contracts:

```typescript
export const contract = c.router({
  identity:     identityContract,
  crm:          crmContract,
  campaign:     campaignContract,
  messaging:    messagingContract,
  content:      contentContract,
  analytics:    analyticsContract,
  integrations: integrationsContract,
});
```

### 5.3 Gateway Routing

Gateway Worker receives all requests and routes to domain Workers via Service Bindings:

- Auth middleware validates session (Better Auth) before proxying
- `/api/<context>/*` -> proxied to corresponding domain Worker
- `/ui/<context>/*` -> proxied to corresponding domain Worker
- `/app/*` -> Gateway serves HTMX page shell, loads partials from `/ui/*`

---

## 6. Database Strategy

### 6.1 Postgres Schemas

Single Neon Postgres database with separate Postgres schemas per bounded context:

| Context | Schema | Key Tables |
|---------|--------|------------|
| Identity | `identity` | users, sessions, accounts, organizations, org_members, verification |
| CRM | `crm` | contacts, companies, segments, segment_filters, fields, field_values, tags, do_not_contact, stages, categories, contact_notes, audit_log |
| Campaign | `campaign` | campaigns, events, actions, decisions, event_log, points, point_triggers |
| Messaging | `messaging` | emails, email_stats, email_copies, send_jobs, sms, sms_stats, notifications |
| Content | `content` | forms, form_fields, form_submissions, pages, page_hits, assets, asset_downloads, dynamic_content |
| Analytics | `analytics` | reports, report_schedules, dashboard_widgets |
| Integrations | `integrations` | integrations, configs, webhooks, webhook_logs, sync_jobs, sync_mappings |

### 6.2 Cross-Context References

- Contexts reference other context's entities by ID only (no foreign keys across schemas)
- Data consistency maintained via domain events, not database constraints
- Each Worker's Drizzle config sets `search_path` to its own schema

### 6.3 Migrations

- Each Worker owns its migrations in `workers/<name>/drizzle/migrations/`
- Root script orchestrates running all migrations in dependency order (Identity first)
- Drizzle Kit for migration generation and execution

---

## 7. Cloudflare Infrastructure

### 7.1 Per-Worker Resources

| Worker | R2 | Queues (Produce) | Queues (Consume) | KV | Hyperdrive |
|--------|----|-----------------|------------------|----|-----------|
| Gateway | -- | -- | -- | Session cache | -- |
| Identity | Avatar storage | user-events | -- | Rate limiting | Neon (identity schema) |
| CRM | -- | crm-events | campaign-events, messaging-events | Segment cache | Neon (crm schema) |
| Campaign | -- | campaign-events | crm-events | -- | Neon (campaign schema) |
| Messaging | Email assets | messaging-events | campaign-events | Send throttle | Neon (messaging schema) |
| Content | Assets, images | content-events | -- | Page cache | Neon (content schema) |
| Analytics | Report exports | -- | All event queues | Dashboard cache | Neon (analytics schema) |
| Integrations | -- | webhook-dispatch | All event queues | API key storage | Neon (integrations schema) |

### 7.2 Queue Event Format

```typescript
interface DomainEvent<T = unknown> {
  type: string;              // e.g., "ContactCreated"
  data: T;                   // Event payload
  metadata: {
    sourceContext: string;    // e.g., "crm"
    timestamp: string;       // ISO 8601
    correlationId: string;   // Request trace ID
    causationId?: string;    // Parent event ID
  };
}
```

### 7.3 Service Bindings

Each Worker declared in Gateway's `wrangler.toml`:

```toml
[[services]]
binding = "CRM_WORKER"
service = "mauntic-crm"

[[services]]
binding = "CAMPAIGN_WORKER"
service = "mauntic-campaign"
# ... etc
```

---

## 8. Authentication (from KMT)

### 8.1 Approach

Port Better Auth implementation from `/Users/lsendel/Projects/knowledge-management-tool`:

- **Session-based auth** with HTTP-only cookies
- **OAuth providers:** Google, GitHub (configurable via env vars)
- **Database-backed sessions** in `identity.sessions` table
- **Multi-tenant:** Organizations with role-based membership (owner, admin, member, viewer)
- **User blocking:** Per-user and per-organization blocking

### 8.2 Auth Flow

1. Gateway receives request
2. Auth middleware calls Identity Worker via Service Binding to validate session
3. Identity Worker checks session cookie against `identity.sessions` table
4. Returns user object (or null for public routes)
5. Gateway passes user context when proxying to domain Workers
6. Domain Workers trust user context from Gateway (internal Service Binding = trusted)

---

## 9. Domain Model Detail

### 9.1 CRM Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| Contact | Contact, ContactField, Tag, DoNotContact, FrequencyRule | Create, update, merge, track activity, manage consent |
| Company | Company, CompanyField | Create, link to contacts |
| Segment | Segment, SegmentFilter | Define filters, rebuild membership (async) |
| Stage | Stage | Pipeline stages for contacts |

Events: ContactCreated, ContactUpdated, ContactMerged, SegmentRebuilt, ContactAddedToSegment

### 9.2 Campaign Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| Campaign | Campaign, CampaignEvent, CampaignAction, CampaignDecision | Build flows, schedule execution |
| CampaignExecution | EventLog, LeadEventLog | Execute events, track results |
| PointScheme | Point, PointTrigger, PointTriggerEvent | Award/deduct points |

Events: CampaignPublished, CampaignEventExecuted, PointsAwarded
Consumes: ContactCreated, ContactUpdated, SegmentRebuilt

### 9.3 Messaging Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| EmailTemplate | Email, EmailStat, EmailCopy | Create templates, track opens/clicks |
| EmailSend | SendJob, SendBatch | Bulk sending, throttling, bounce handling |
| SmsMessage | Sms, SmsStat | SMS delivery |
| PushNotification | Notification, NotificationStat | Push delivery |

Events: EmailSent, EmailOpened, EmailClicked, EmailBounced, SmsSent
Consumes: CampaignEventExecuted

### 9.4 Content Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| Form | Form, FormField, FormAction, FormSubmission | Build forms, process submissions |
| LandingPage | Page, PageHit | Create pages, track visits |
| Asset | Asset, AssetDownload | File management, download tracking |
| DynamicContent | DynamicContent, DwcDecision | Conditional content |

### 9.5 Analytics Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| Report | Report, ReportSchedule | Define queries, schedule generation |
| Widget | DashboardWidget | Widget definitions and data |

Consumes: Events from all contexts for aggregation

### 9.6 Integrations Context

| Aggregate | Entities | Key Behaviors |
|-----------|----------|---------------|
| Integration | Integration, IntegrationConfig | Configure third-party connections |
| Webhook | Webhook, WebhookQueue, WebhookLog | Dispatch webhooks on events |
| Sync | SyncJob, SyncMapping | Bi-directional data sync |

Consumes: Events from all contexts

---

## 10. Migration Phasing

### Phase 0: Foundation (Week 1-2)
- Set up monorepo (Turborepo, pnpm workspaces, tsconfig)
- Create all shared packages (contracts, domain-kernel, worker-lib, ui-kit)
- Set up Gateway Worker with Better Auth (port from KMT)
- Set up Neon Postgres with Hyperdrive bindings
- Create Postgres schemas for all contexts
- CI/CD pipeline (GitHub Actions -> Wrangler deploy)

### Phase 1: Define All Contracts (Week 2-4)
- Map every Mautic API endpoint to ts-rest contracts
- Define all Zod schemas for request/response types
- Define all domain events in domain-kernel
- Blueprint only -- no implementation

### Phase 2: Identity Context (Week 4-5)
- Port auth from KMT to Identity Worker
- Users, roles, permissions, organizations
- Better Auth + Drizzle on identity schema
- Gateway <-> Identity Service Binding

### Phase 3: CRM Context (Week 5-8)
- Contact, Company, Segment, Field, Tag aggregates
- Full DDD implementation
- HTMX UI for contact management
- Queue publishers for CRM events

### Phase 4: Campaign Context (Week 8-10)
- Campaign builder, events, actions, decisions
- Campaign execution engine (Queue-driven)
- Point system
- Consumes CRM events

### Phase 5: Messaging Context (Week 10-13)
- Email template builder
- Bulk send engine (Queue-driven batching)
- SMS and push notification support
- R2 for email assets
- Open/click tracking

### Phase 6: Content Context (Week 13-15)
- Form builder + submission processing
- Landing page builder
- Asset management (R2)
- Dynamic content engine

### Phase 7: Analytics & Integrations (Week 15-18)
- Reporting engine + dashboard widgets
- Webhook dispatch
- Third-party CRM sync
- Integration configuration UI

### Phase 8: Polish & Migrate (Week 18-20)
- Data migration scripts (MySQL -> Neon Postgres)
- End-to-end testing
- Performance optimization
- Documentation
