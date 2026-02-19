# Mauntic3 Migration Implementation Plan (v3)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite Mautic + Parcelvoy + BillionMail as a unified multi-tenant SaaS marketing platform on Cloudflare Workers + Fly.io with DDD architecture.

**Architecture:** Dual-tier deployment — Cloudflare Workers at the edge for API/UI/light processing, Fly.io machines for heavy compute (journey execution, bulk sends, analytics, mail server). Domain logic lives in shared packages (`packages/domains/*`), deployed to either tier via different entry points. 11 bounded contexts (including Billing), contract-first with ts-rest. Full SaaS multi-tenancy with per-org isolation, Stripe billing, and quota enforcement.

**Tech Stack:** Hono, ts-rest, Zod, Drizzle ORM, Better Auth, Stripe, Cloudflare Workers/R2/Queues/KV/Hyperdrive, Fly.io, BullMQ, Redis, Postfix/Dovecot/Rspamd, Turborepo, pnpm, HTMX, Hono JSX, Tailwind CSS, pino (logging)

**Design Doc:** `docs/plans/2026-02-12-mauntic-migration-design.md` (v3)

**Auth Reference:** `/Users/lsendel/Projects/knowledge-management-tool`

**Journey Reference:** [Parcelvoy](https://github.com/parcelvoy/platform)

**Mail Reference:** [BillionMail](https://github.com/Billionmail/BillionMail)

> **Note:** Steps involving `docker-compose.dev.yml` describe the original migration workflow. Local development now uses the shared Neon database directly and no longer relies on Docker.

---

## Phase 0: Foundation (Tasks 1-20)

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.npmrc`
- Create: `.gitignore`

**Step 1: Initialize pnpm workspace root**

```bash
pnpm init
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "packages/domains/*"
  - "workers/*"
  - "services/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "deploy": {
      "dependsOn": ["build", "typecheck"]
    },
    "db:generate": {},
    "db:migrate": {}
  }
}
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

**Step 5: Create .gitignore and .npmrc**

`.gitignore`:
```
node_modules/
dist/
.wrangler/
.turbo/
.env
.env.local
.dev.vars
*.log
```

`.npmrc`:
```
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 6: Install root dev dependencies**

```bash
pnpm add -Dw turbo typescript @cloudflare/workers-types
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: initialize monorepo with Turborepo and pnpm workspaces"
```

---

### Task 2: Create domain-kernel Package

**Files:**
- Create: `packages/domain-kernel/package.json`
- Create: `packages/domain-kernel/tsconfig.json`
- Create: `packages/domain-kernel/src/index.ts`
- Create: `packages/domain-kernel/src/value-objects/branded-id.ts`
- Create: `packages/domain-kernel/src/value-objects/email-address.ts`
- Create: `packages/domain-kernel/src/value-objects/index.ts`
- Create: `packages/domain-kernel/src/events/domain-event.ts`
- Create: `packages/domain-kernel/src/events/index.ts`
- Create: `packages/domain-kernel/src/delivery/provider.ts`
- Create: `packages/domain-kernel/src/delivery/index.ts`
- Create: `packages/domain-kernel/src/errors/domain-error.ts`
- Create: `packages/domain-kernel/src/errors/index.ts`
- Create: `packages/domain-kernel/src/tenant/tenant-context.ts`
- Create: `packages/domain-kernel/src/tenant/index.ts`
- Create: `packages/domain-kernel/src/types/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/domain-kernel",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./value-objects": { "import": "./dist/value-objects/index.js", "types": "./dist/value-objects/index.d.ts" },
    "./events": { "import": "./dist/events/index.js", "types": "./dist/events/index.d.ts" },
    "./delivery": { "import": "./dist/delivery/index.js", "types": "./dist/delivery/index.d.ts" },
    "./errors": { "import": "./dist/errors/index.js", "types": "./dist/errors/index.d.ts" },
    "./tenant": { "import": "./dist/tenant/index.js", "types": "./dist/tenant/index.d.ts" },
    "./types": { "import": "./dist/types/index.js", "types": "./dist/types/index.d.ts" }
  },
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

**Step 2: Create DomainError hierarchy**

File: `packages/domain-kernel/src/errors/domain-error.ts`

```typescript
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

**Step 3: Create TenantContext**

File: `packages/domain-kernel/src/tenant/tenant-context.ts`

```typescript
export interface TenantContext {
  organizationId: number;
  userId: number;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
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

**Step 4: Create branded IDs**

File: `packages/domain-kernel/src/value-objects/branded-id.ts`

```typescript
import { z } from 'zod';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ContactId = Brand<number, 'ContactId'>;
export type CompanyId = Brand<number, 'CompanyId'>;
export type CampaignId = Brand<number, 'CampaignId'>;
export type EmailId = Brand<number, 'EmailId'>;
export type FormId = Brand<number, 'FormId'>;
export type PageId = Brand<number, 'PageId'>;
export type AssetId = Brand<number, 'AssetId'>;
export type SegmentId = Brand<number, 'SegmentId'>;
export type UserId = Brand<number, 'UserId'>;
export type OrganizationId = Brand<number, 'OrganizationId'>;
export type WebhookId = Brand<number, 'WebhookId'>;
export type IntegrationId = Brand<number, 'IntegrationId'>;
export type ReportId = Brand<number, 'ReportId'>;
export type JourneyId = Brand<number, 'JourneyId'>;
export type JourneyVersionId = Brand<number, 'JourneyVersionId'>;
export type JourneyStepId = Brand<string, 'JourneyStepId'>;
export type DeliveryJobId = Brand<string, 'DeliveryJobId'>;
export type TemplateId = Brand<number, 'TemplateId'>;
export type SubscriptionId = Brand<string, 'SubscriptionId'>;
export type PlanId = Brand<number, 'PlanId'>;

export const ContactIdSchema = z.number().int().positive() as z.ZodType<ContactId>;
export const CompanyIdSchema = z.number().int().positive() as z.ZodType<CompanyId>;
export const CampaignIdSchema = z.number().int().positive() as z.ZodType<CampaignId>;
export const JourneyIdSchema = z.number().int().positive() as z.ZodType<JourneyId>;
export const DeliveryJobIdSchema = z.string().uuid() as z.ZodType<DeliveryJobId>;
export const OrganizationIdSchema = z.number().int().positive() as z.ZodType<OrganizationId>;
// ... remaining schemas follow same pattern
```

**Step 5: Create domain events with versioned metadata and tenant context**

File: `packages/domain-kernel/src/events/domain-event.ts`

```typescript
export interface DomainEventMetadata {
  version: number;
  sourceContext: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  tenantContext: {
    organizationId: number;
  };
}

export interface DomainEvent<TType extends string = string, TData = unknown> {
  type: TType;
  data: TData;
  metadata: DomainEventMetadata;
}

// CRM Events
export interface ContactCreatedEvent extends DomainEvent<'ContactCreated', { contactId: number; organizationId: number }> {}
export interface ContactUpdatedEvent extends DomainEvent<'ContactUpdated', { contactId: number; organizationId: number; fields: string[] }> {}
export interface ContactMergedEvent extends DomainEvent<'ContactMerged', { winnerId: number; loserId: number; organizationId: number }> {}
export interface SegmentRebuiltEvent extends DomainEvent<'SegmentRebuilt', { segmentId: number; organizationId: number; contactCount: number }> {}

// Journey Events (from Parcelvoy)
export interface JourneyPublishedEvent extends DomainEvent<'JourneyPublished', { journeyId: number; versionId: number; organizationId: number }> {}
export interface JourneyStepExecutedEvent extends DomainEvent<'JourneyStepExecuted', { journeyId: number; stepId: string; contactId: number; stepType: string; organizationId: number }> {}
export interface JourneyCompletedEvent extends DomainEvent<'JourneyCompleted', { journeyId: number; executionId: string; contactId: number; organizationId: number }> {}
export interface ExecuteNextStepEvent extends DomainEvent<'ExecuteNextStep', { executionId: string; stepId: string; organizationId: number }> {}

// Delivery Events (from BillionMail + Parcelvoy)
export interface SendMessageEvent extends DomainEvent<'SendMessage', { channel: Channel; contactId: number; templateId: number; organizationId: number; journeyExecutionId?: string; campaignId?: number; idempotencyKey: string }> {}
export interface EmailSentEvent extends DomainEvent<'EmailSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}
export interface EmailOpenedEvent extends DomainEvent<'EmailOpened', { deliveryJobId: string; contactId: number; organizationId: number }> {}
export interface EmailClickedEvent extends DomainEvent<'EmailClicked', { deliveryJobId: string; contactId: number; organizationId: number; url: string }> {}
export interface EmailBouncedEvent extends DomainEvent<'EmailBounced', { deliveryJobId: string; contactId: number; organizationId: number; bounceType: 'hard' | 'soft'; reason: string }> {}
export interface SmsSentEvent extends DomainEvent<'SmsSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}
export interface PushSentEvent extends DomainEvent<'PushSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}

// Campaign Events
export interface CampaignSentEvent extends DomainEvent<'CampaignSent', { campaignId: number; organizationId: number; contactCount: number }> {}
export interface PointsAwardedEvent extends DomainEvent<'PointsAwarded', { contactId: number; organizationId: number; points: number }> {}

// Content Events
export interface FormSubmittedEvent extends DomainEvent<'FormSubmitted', { formId: number; submissionId: number; organizationId: number; contactId?: number }> {}
export interface PageVisitedEvent extends DomainEvent<'PageVisited', { pageId: number; organizationId: number; contactId?: number }> {}
export interface AssetDownloadedEvent extends DomainEvent<'AssetDownloaded', { assetId: number; organizationId: number; contactId?: number }> {}

// Identity Events
export interface UserCreatedEvent extends DomainEvent<'UserCreated', { userId: number }> {}
export interface OrgCreatedEvent extends DomainEvent<'OrgCreated', { organizationId: number; ownerId: number }> {}
export interface MemberJoinedEvent extends DomainEvent<'MemberJoined', { organizationId: number; userId: number; role: string }> {}

// Billing Events
export interface SubscriptionCreatedEvent extends DomainEvent<'SubscriptionCreated', { organizationId: number; plan: string; stripeSubscriptionId: string }> {}
export interface PlanUpgradedEvent extends DomainEvent<'PlanUpgraded', { organizationId: number; fromPlan: string; toPlan: string }> {}
export interface QuotaExceededEvent extends DomainEvent<'QuotaExceeded', { organizationId: number; resource: string; limit: number; current: number }> {}
export interface PaymentFailedEvent extends DomainEvent<'PaymentFailed', { organizationId: number; invoiceId: string }> {}

export type Channel = 'email' | 'sms' | 'push' | 'webhook';

export type AnyDomainEvent =
  | ContactCreatedEvent | ContactUpdatedEvent | ContactMergedEvent | SegmentRebuiltEvent
  | JourneyPublishedEvent | JourneyStepExecutedEvent | JourneyCompletedEvent | ExecuteNextStepEvent
  | SendMessageEvent | EmailSentEvent | EmailOpenedEvent | EmailClickedEvent | EmailBouncedEvent | SmsSentEvent | PushSentEvent
  | CampaignSentEvent | PointsAwardedEvent
  | FormSubmittedEvent | PageVisitedEvent | AssetDownloadedEvent
  | UserCreatedEvent | OrgCreatedEvent | MemberJoinedEvent
  | SubscriptionCreatedEvent | PlanUpgradedEvent | QuotaExceededEvent | PaymentFailedEvent;
```

**Step 6: Create DeliveryProvider interface**

File: `packages/domain-kernel/src/delivery/provider.ts`

(Same as v2, unchanged)

```typescript
import type { Channel } from '../events/domain-event';

export interface EmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

export interface SmsPayload {
  to: string;
  from: string;
  body: string;
}

export interface PushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export interface WebhookPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: unknown;
}

export type ChannelPayload<T extends Channel> =
  T extends 'email' ? EmailPayload :
  T extends 'sms' ? SmsPayload :
  T extends 'push' ? PushPayload :
  T extends 'webhook' ? WebhookPayload :
  never;

export interface DeliveryResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';

export interface TrackingEvent {
  type: 'open' | 'click' | 'bounce' | 'complaint' | 'unsubscribe';
  externalId: string;
  contactId?: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface DeliveryProvider<TChannel extends Channel> {
  channel: TChannel;
  name: string;
  send(payload: ChannelPayload<TChannel>): Promise<DeliveryResult>;
  checkStatus?(externalId: string): Promise<DeliveryStatus>;
  handleWebhook?(request: Request): Promise<TrackingEvent[]>;
}
```

**Step 7: Create index files, build, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/domain-kernel build
git add packages/domain-kernel/ && git commit -m "feat: add domain-kernel with errors, tenant context, versioned events, value objects, and delivery provider interface"
```

---

### Task 3: Create contracts Package

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/common.ts`
- Create: `packages/contracts/src/identity.contract.ts`
- Create: `packages/contracts/src/billing.contract.ts`
- Create: `packages/contracts/src/crm.contract.ts`
- Create: `packages/contracts/src/journey.contract.ts`
- Create: `packages/contracts/src/delivery.contract.ts`
- Create: `packages/contracts/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@ts-rest/core": "^3.51.0",
    "zod": "^3.23.0",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

**Step 2: Create common schemas** (PaginationQuery, PaginatedResponse, Error, IdParam)

**Step 3: Create identity contract** (users, orgs, org members, invites, auth)

**Step 4: Create billing contract stub**

File: `packages/contracts/src/billing.contract.ts`

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, IdParamSchema } from './common';

const c = initContract();

export const PlanSchema = z.object({
  id: z.number(),
  name: z.enum(['free', 'starter', 'pro', 'enterprise']),
  displayName: z.string(),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  limits: z.record(z.number()),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  organizationId: z.number(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing']),
  currentPeriodEnd: z.string(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
});

export const UsageSchema = z.object({
  resource: z.string(),
  current: z.number(),
  limit: z.number(),
  resetAt: z.string().nullable(),
});

export const billingContract = c.router({
  plans: {
    list: {
      method: 'GET',
      path: '/api/v1/billing/plans',
      responses: { 200: z.array(PlanSchema) },
    },
  },
  subscription: {
    get: {
      method: 'GET',
      path: '/api/v1/billing/subscription',
      responses: { 200: SubscriptionSchema },
    },
    create: {
      method: 'POST',
      path: '/api/v1/billing/subscription',
      body: z.object({ plan: z.enum(['starter', 'pro', 'enterprise']), paymentMethodId: z.string().optional() }),
      responses: { 201: SubscriptionSchema, 400: ErrorSchema },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/billing/subscription',
      body: z.object({ plan: z.enum(['free', 'starter', 'pro', 'enterprise']) }),
      responses: { 200: SubscriptionSchema, 400: ErrorSchema },
    },
    cancel: {
      method: 'DELETE',
      path: '/api/v1/billing/subscription',
      body: z.any().optional(),
      responses: { 200: SubscriptionSchema },
    },
  },
  usage: {
    get: {
      method: 'GET',
      path: '/api/v1/billing/usage',
      responses: { 200: z.array(UsageSchema) },
    },
  },
  portal: {
    create: {
      method: 'POST',
      path: '/api/v1/billing/portal',
      body: z.object({}).optional(),
      responses: { 200: z.object({ url: z.string() }) },
    },
  },
  webhook: {
    handle: {
      method: 'POST',
      path: '/api/v1/billing/webhook',
      body: z.any(),
      responses: { 200: z.object({ received: z.boolean() }) },
    },
  },
});
```

**Step 5: Create CRM contract** with /api/v1/ prefix

**Step 6: Create journey contract** with /api/v1/ prefix (same schemas as v2 but with versioned paths)

**Step 7: Create delivery contract** with /api/v1/ prefix (same schemas as v2 but with versioned paths)

**Step 8: Update root index, build, commit**

```bash
pnpm install && pnpm --filter @mauntic/contracts build
git add packages/contracts/ && git commit -m "feat: add contracts with billing, journey, delivery, CRM, and identity ts-rest contracts (v1 API)"
```

---

### Task 4: Create worker-lib Package

**Files:**
- Create: `packages/worker-lib/package.json`
- Create: `packages/worker-lib/tsconfig.json`
- Create: `packages/worker-lib/src/index.ts`
- Create: `packages/worker-lib/src/middleware/error-handler.ts`
- Create: `packages/worker-lib/src/middleware/logging.ts`
- Create: `packages/worker-lib/src/middleware/tenant.ts`
- Create: `packages/worker-lib/src/middleware/csrf.ts`
- Create: `packages/worker-lib/src/middleware/circuit-breaker.ts`
- Create: `packages/worker-lib/src/middleware/cors.ts`
- Create: `packages/worker-lib/src/hyperdrive/database.ts`
- Create: `packages/worker-lib/src/queue/publisher.ts`
- Create: `packages/worker-lib/src/queue/consumer.ts`
- Create: `packages/worker-lib/src/transaction/unit-of-work.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/worker-lib",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "hono": "^4.7.0",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "@mauntic/domain-kernel": "workspace:*",
    "pino": "^9.0.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "@cloudflare/workers-types": "^4.0.0" }
}
```

**Step 2: Create error handler middleware**

```typescript
// packages/worker-lib/src/middleware/error-handler.ts
import { DomainError } from '@mauntic/domain-kernel/errors';

export function errorHandler() {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = c.get('requestId') ?? 'unknown';
      if (err instanceof DomainError) {
        return c.json({ error: err.code, message: err.message, details: err.details, requestId }, err.statusCode);
      }
      c.get('logger')?.error({ err, requestId }, 'Unhandled error');
      return c.json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId }, 500);
    }
  };
}
```

**Step 3: Create tenant context middleware**

```typescript
// packages/worker-lib/src/middleware/tenant.ts
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

export function tenantMiddleware() {
  return async (c, next) => {
    const header = c.req.header('X-Tenant-Context');
    if (!header) return c.json({ error: 'MISSING_TENANT' }, 400);
    const tenant: TenantContext = JSON.parse(header);
    c.set('tenant', tenant);
    await next();
  };
}
```

**Step 4: Create CSRF middleware**

```typescript
// packages/worker-lib/src/middleware/csrf.ts
export function csrfMiddleware(kv: KVNamespace) {
  return async (c, next) => {
    const method = c.req.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
    // API key auth is exempt from CSRF
    if (c.req.header('Authorization')?.startsWith('Bearer ')) return next();
    const token = c.req.header('X-CSRF-Token');
    const sessionId = c.get('sessionId');
    if (!token || !sessionId) return c.json({ error: 'CSRF_TOKEN_REQUIRED' }, 403);
    const stored = await kv.get(`csrf:${sessionId}`);
    if (stored !== token) return c.json({ error: 'CSRF_TOKEN_INVALID' }, 403);
    await next();
  };
}
```

**Step 5: Create circuit breaker**

```typescript
// packages/worker-lib/src/middleware/circuit-breaker.ts
// States: CLOSED → OPEN → HALF_OPEN
// Tracked in KV per service endpoint
// Threshold: 5 failures in 60s → OPEN for 30s
export class CircuitBreaker {
  constructor(private kv: KVNamespace, private service: string) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.kv.get(`cb:${this.service}`);
    if (state === 'open') {
      const openedAt = await this.kv.get(`cb:${this.service}:opened`);
      if (openedAt && Date.now() - Number(openedAt) < 30_000) {
        throw new DomainError('SERVICE_UNAVAILABLE', `${this.service} is temporarily unavailable`, 503);
      }
      // Half-open: try one request
    }
    try {
      const result = await fn();
      await this.kv.delete(`cb:${this.service}`);
      return result;
    } catch (err) {
      await this.recordFailure();
      throw err;
    }
  }

  private async recordFailure() {
    const key = `cb:${this.service}:failures`;
    const count = Number(await this.kv.get(key) ?? 0) + 1;
    await this.kv.put(key, String(count), { expirationTtl: 60 });
    if (count >= 5) {
      await this.kv.put(`cb:${this.service}`, 'open', { expirationTtl: 60 });
      await this.kv.put(`cb:${this.service}:opened`, String(Date.now()), { expirationTtl: 60 });
    }
  }
}
```

**Step 6: Create transaction wrapper (unit of work with RLS)**

```typescript
// packages/worker-lib/src/transaction/unit-of-work.ts
import { sql } from 'drizzle-orm';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

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

**Step 7: Create queue consumer with idempotency**

```typescript
// packages/worker-lib/src/queue/consumer.ts
export function createIdempotentConsumer<T>(
  handler: (message: T, ctx: TenantContext) => Promise<void>,
  kv: KVNamespace,
) {
  return async (batch: MessageBatch<T>) => {
    for (const msg of batch.messages) {
      const idempotencyKey = `idem:${msg.id}`;
      const existing = await kv.get(idempotencyKey);
      if (existing) { msg.ack(); continue; }
      try {
        const data = msg.body as any;
        await handler(data, data.metadata?.tenantContext ?? data.tenantContext);
        await kv.put(idempotencyKey, '1', { expirationTtl: 86400 }); // 24h TTL
        msg.ack();
      } catch (err) {
        msg.retry();
      }
    }
  };
}
```

**Step 8: Create logging middleware**

```typescript
// packages/worker-lib/src/middleware/logging.ts
import pino from 'pino';

export function loggingMiddleware(serviceName: string) {
  return async (c, next) => {
    const requestId = c.req.header('X-Request-Id') ?? crypto.randomUUID();
    const logger = pino({ level: 'info', base: { service: serviceName, requestId } });
    c.set('requestId', requestId);
    c.set('logger', logger);
    c.header('X-Request-Id', requestId);
    const start = Date.now();
    await next();
    logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, duration: Date.now() - start }, 'request');
  };
}
```

**Step 9: Build, commit**

```bash
pnpm install && pnpm --filter @mauntic/worker-lib build
git add packages/worker-lib/ && git commit -m "feat: add worker-lib with error handling, tenant context, CSRF, circuit breaker, idempotent consumers, and logging"
```

---

### Task 5: Create process-lib Package

**Files:**
- Create: `packages/process-lib/package.json`
- Create: `packages/process-lib/tsconfig.json`
- Create: `packages/process-lib/src/index.ts`
- Create: `packages/process-lib/src/bullmq/job-processor.ts`
- Create: `packages/process-lib/src/redis/connection.ts`
- Create: `packages/process-lib/src/scheduler/cron.ts`
- Create: `packages/process-lib/src/health/server.ts`
- Create: `packages/process-lib/src/database/connection.ts`
- Create: `packages/process-lib/src/database/transaction.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/process-lib",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./bullmq": { "import": "./dist/bullmq/job-processor.js", "types": "./dist/bullmq/job-processor.d.ts" },
    "./redis": { "import": "./dist/redis/connection.js", "types": "./dist/redis/connection.d.ts" },
    "./health": { "import": "./dist/health/server.js", "types": "./dist/health/server.d.ts" },
    "./database": { "import": "./dist/database/connection.js", "types": "./dist/database/connection.d.ts" },
    "./scheduler": { "import": "./dist/scheduler/cron.js", "types": "./dist/scheduler/cron.d.ts" }
  },
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "pino": "^9.0.0",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

**Step 2: Create Redis connection helper** (same as v2)

**Step 3: Create BullMQ job processor with idempotency**

```typescript
// packages/process-lib/src/bullmq/job-processor.ts
import { Worker, Queue, type Job } from 'bullmq';
import { getRedis } from '../redis/connection';

export interface JobHandler<TData = unknown, TResult = void> {
  name: string;
  process(job: Job<TData>): Promise<TResult>;
  concurrency?: number;
}

export function createQueue(name: string): Queue {
  return new Queue(name, { connection: getRedis() });
}

export function createWorker<TData>(
  queueName: string,
  handler: JobHandler<TData>,
): Worker<TData> {
  return new Worker<TData>(
    queueName,
    async (job) => {
      // Idempotency: check if job was already processed
      const redis = getRedis();
      const idempotencyKey = `idem:${queueName}:${job.id}`;
      const existing = await redis.get(idempotencyKey);
      if (existing) return; // Already processed
      const result = await handler.process(job);
      await redis.setex(idempotencyKey, 86400, '1'); // 24h TTL
      return result;
    },
    {
      connection: getRedis(),
      concurrency: handler.concurrency ?? 5,
    },
  );
}
```

**Step 4: Create Neon pooler connection for Fly.io**

```typescript
// packages/process-lib/src/database/connection.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb(poolerUrl?: string) {
  if (!dbInstance) {
    const sql = neon(poolerUrl ?? process.env.DATABASE_POOLER_URL!);
    dbInstance = drizzle(sql);
  }
  return dbInstance;
}
```

**Step 5: Create transaction wrapper for Fly.io (with RLS)**

```typescript
// packages/process-lib/src/database/transaction.ts
import { sql } from 'drizzle-orm';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

export async function withTransaction<T>(
  db: any,
  tenantContext: TenantContext,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL app.organization_id = ${tenantContext.organizationId}`);
    return fn(tx);
  });
}
```

**Step 6: Create cron scheduler**

```typescript
// packages/process-lib/src/scheduler/cron.ts
import { Queue } from 'bullmq';
import { getRedis } from '../redis/connection';

export interface ScheduledJob {
  name: string;
  pattern: string; // cron pattern
  data?: Record<string, unknown>;
}

export async function registerScheduledJobs(queueName: string, jobs: ScheduledJob[]): Promise<Queue> {
  const queue = new Queue(queueName, { connection: getRedis() });
  for (const job of jobs) {
    await queue.upsertJobScheduler(job.name, { pattern: job.pattern }, { data: job.data ?? {} });
  }
  return queue;
}
```

**Step 7: Create health check server** (same as v2)

**Step 8: Build, commit**

```bash
pnpm install && pnpm --filter @mauntic/process-lib build
git add packages/process-lib/ && git commit -m "feat: add process-lib with idempotent BullMQ, Neon pooler connection, RLS transactions, cron scheduler, and health check"
```

---

### Task 6: Create ui-kit Package

Same as v2 plan. Create layouts, components, styles directories. Include Tailwind CSS setup.

---

### Task 7: Create Domain Packages Structure

Create the empty domain package scaffolding for all 9 domain contexts (added billing-domain).

**Packages:**
- `packages/domains/identity-domain/`
- `packages/domains/billing-domain/` (NEW)
- `packages/domains/crm-domain/`
- `packages/domains/journey-domain/`
- `packages/domains/campaign-domain/`
- `packages/domains/delivery-domain/`
- `packages/domains/content-domain/`
- `packages/domains/analytics-domain/`
- `packages/domains/integrations-domain/`

Each package contains:
```
src/
├── entities/         # Aggregate roots and entities
├── value-objects/    # Value objects
├── events/           # Context-specific event factories
├── repositories/     # Port interfaces (always accept organizationId)
├── services/         # Pure domain services (no side effects)
├── application/      # Application services (orchestration, side effects)
├── commands/         # Command definitions
├── queries/          # Query definitions
├── event-handlers/   # Cross-context event consumers
├── acl/              # Anti-Corruption Layer translators
└── index.ts
drizzle/
├── schema.ts         # Single source of truth for this context's schema
└── migrations/
```

Template package.json for each:

```json
{
  "name": "@mauntic/<context>-domain",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./drizzle": { "import": "./drizzle/schema.js", "types": "./drizzle/schema.d.ts" }
  },
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit", "test": "vitest", "db:generate": "drizzle-kit generate" },
  "dependencies": {
    "@mauntic/domain-kernel": "workspace:*",
    "drizzle-orm": "^0.38.0",
    "zod": "^3.23.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0", "drizzle-kit": "^0.30.0" }
}
```

**Commit:**
```bash
git add packages/domains/ && git commit -m "feat: scaffold 9 domain packages with DDD directory structure including ACL and application layers"
```

---

### Task 8: Set Up Local Development Environment

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `scripts/init-schemas.ts`
- Create: `scripts/migrate-all.ts`
- Create: `scripts/seed.ts`

**Step 1: Create docker-compose.dev.yml**

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mauntic"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

**Step 2: Create schema initialization script**

File: `scripts/init-schemas.ts`

```typescript
import { neon } from '@neondatabase/serverless';

const schemas = ['identity', 'billing', 'crm', 'journey', 'campaign', 'delivery', 'content', 'analytics', 'integrations'];

async function initSchemas() {
  const sql = neon(process.env.DATABASE_URL!);

  for (const schema of schemas) {
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
    console.log(`Created schema: ${schema}`);
  }

  // RLS policies are created after tables exist (run after migrations)
  console.log('All schemas created. Run migrations next, then apply RLS.');
}

initSchemas().catch(console.error);
```

**Step 3: Create migration orchestrator**

File: `scripts/migrate-all.ts`

```typescript
// Runs all context migrations in dependency order:
// 1. identity (no deps)
// 2. billing (depends on identity.organizations)
// 3. crm, content, campaign (depend on identity)
// 4. delivery (depends on crm for contact refs)
// 5. journey (depends on crm, delivery)
// 6. analytics, integrations (depend on all above)
const migrationOrder = [
  'identity-domain', 'billing-domain', 'crm-domain', 'content-domain',
  'campaign-domain', 'delivery-domain', 'journey-domain',
  'analytics-domain', 'integrations-domain',
];

async function migrateAll() {
  for (const domain of migrationOrder) {
    console.log(`Migrating ${domain}...`);
    // Run drizzle-kit migrate for each domain package
  }
}
```

**Step 4: Create seed script stub**

```typescript
// scripts/seed.ts
// Creates: demo org, admin user, sample contacts, sample journey
```

**Step 5: Commit**

```bash
git add docker-compose.dev.yml scripts/ && git commit -m "feat: add local dev setup with docker-compose, schema init, migration orchestrator, and seed script"
```

---

### Task 9: Set Up Neon Postgres with Schemas and RLS

**Step 1: Provision Neon project** (manual or via Neon CLI)

**Step 2: Run schema initialization**
```bash
DATABASE_URL=<neon-url> npx tsx scripts/init-schemas.ts
```

**Step 3: Create RLS policy application script**

File: `scripts/apply-rls.ts`

```typescript
// Runs after migrations — enables RLS on all tables with organization_id
// Skips identity.users, identity.sessions, identity.accounts, identity.verification
// Creates tenant_isolation policy on all other tables
```

**Step 4: Commit**

```bash
git add scripts/apply-rls.ts && git commit -m "feat: add RLS policy application script for tenant isolation"
```

---

### Task 10: Create Gateway Worker

**Files:**
- Create: `workers/gateway/package.json`
- Create: `workers/gateway/tsconfig.json`
- Create: `workers/gateway/wrangler.toml`
- Create: `workers/gateway/src/app.ts`
- Create: `workers/gateway/src/index.ts`
- Create: `workers/gateway/src/middleware/auth.ts`
- Create: `workers/gateway/src/middleware/tenant.ts`
- Create: `workers/gateway/src/middleware/rate-limit.ts`

Gateway Worker responsibilities:
1. CORS middleware
2. Logging middleware (generates X-Request-Id)
3. Auth middleware (calls Identity Worker via Service Binding, extracts user + org)
4. Tenant context middleware (constructs TenantContext, sets X-Tenant-Context header)
5. CSRF middleware (validates on mutating requests)
6. Rate limiting middleware (checks plan-based limits in KV)
7. Routes to domain Workers via Service Bindings
8. Serves HTMX page shell for `/app/*`

wrangler.toml includes:
- Service Bindings to all domain Workers
- KV namespace for sessions, CSRF, rate limits
- Hyperdrive binding (not used directly, but available)

**Commit:**
```bash
git add workers/gateway/ && git commit -m "feat: add Gateway Worker with auth, tenant context, CSRF, rate limiting, and service binding routing"
```

---

### Task 11: Create Identity Worker (Port from KMT)

Port Better Auth from `/Users/lsendel/Projects/knowledge-management-tool`:
- Per-request Better Auth instance (required for CF Workers)
- Google + GitHub OAuth
- Session-based auth with HTTP-only cookies
- Custom user fields: role, isBlocked, lastSignedIn, loginMethod
- Organizations: create, invite, join, switch active
- Org members: roles (owner, admin, member, viewer)
- Drizzle schema in `packages/domains/identity-domain/drizzle/schema.ts`

**Key files to reference from KMT:**
- `server/infrastructure/better-auth.ts` — auth config
- `server/infrastructure/auth.ts` — middleware
- `server/infrastructure/hono-adapter.ts` — route handler wrapper (`createRoute`)
- `drizzle/schema.ts` — tables (users, sessions, accounts, organizations, org_members)
- `shared/contracts/identity.contract.ts` — contract patterns

**Commit:**
```bash
git add packages/domains/identity-domain/ workers/identity/ && git commit -m "feat: add Identity context with Better Auth, organizations, and role-based access control"
```

---

### Task 12: Create Billing Worker + Domain

**Files:**
- `packages/domains/billing-domain/drizzle/schema.ts` (subscriptions, usage_records, invoices, plans, plan_limits)
- `packages/domains/billing-domain/src/entities/subscription.ts`
- `packages/domains/billing-domain/src/entities/usage-record.ts`
- `packages/domains/billing-domain/src/entities/plan.ts`
- `packages/domains/billing-domain/src/services/quota-checker.ts`
- `packages/domains/billing-domain/src/application/stripe-webhook-handler.ts`
- `packages/domains/billing-domain/src/application/subscription-manager.ts`
- `workers/billing/` (wrangler.toml, app.ts, index.ts, infrastructure/, interface/)

Billing schema (all in `billing` Postgres schema):
- `plans`: id, name, display_name, price_monthly, price_yearly, is_active
- `plan_limits`: id, plan_id, resource, limit_value (-1 = unlimited)
- `subscriptions`: id, organization_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, trial_end
- `usage_records`: id, organization_id, resource, period_start, period_end, current_value
- `invoices`: id, organization_id, stripe_invoice_id, amount, status, period_start, period_end, paid_at

Stripe webhook handler processes: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created/updated/deleted`, `checkout.session.completed`

QuotaChecker is called by other contexts before resource-consuming operations.

**Commit:**
```bash
git add packages/domains/billing-domain/ workers/billing/ && git commit -m "feat: add Billing context with Stripe subscriptions, usage metering, and quota enforcement"
```

---

### Task 13: Create CRM Worker Skeleton

Domain logic in `packages/domains/crm-domain/`. Worker at `workers/crm/` only has infrastructure + interface.

Schema in `packages/domains/crm-domain/drizzle/schema.ts`:
- All tables include `organization_id` column
- Indexes on `(organization_id, email)`, `(organization_id, updated_at)` etc.

**Commit:**
```bash
git add packages/domains/crm-domain/ workers/crm/ && git commit -m "feat: add CRM Worker skeleton with org-scoped schema and DDD structure"
```

---

### Task 14: Create Journey Worker Skeleton

Schema in `packages/domains/journey-domain/drizzle/schema.ts`:
- `pgSchema('journey')` with tables: journeys, journey_versions, journey_steps, journey_triggers, journey_executions, step_executions, execution_logs
- All tables include `organization_id`
- Indexes on `(organization_id, status)`, `(journey_id, contact_id)`

**Commit:**
```bash
git add packages/domains/journey-domain/ workers/journey/ && git commit -m "feat: add Journey Worker skeleton with versioning schema and DDD structure"
```

---

### Task 15: Create Delivery Worker Skeleton

Schema in `packages/domains/delivery-domain/drizzle/schema.ts`:
- All tables include `organization_id`
- Unique index on `idempotency_key` for delivery_jobs
- Indexes on `(organization_id, status)`, `(organization_id, email)` for suppressions

**Commit:**
```bash
git add packages/domains/delivery-domain/ workers/delivery/ && git commit -m "feat: add Delivery Worker skeleton with org-scoped provider config and suppression schemas"
```

---

### Task 16: Create Remaining Worker Skeletons

Create Campaign, Content, Analytics, and Integrations Workers following the same pattern.

All schemas in respective `packages/domains/<name>-domain/drizzle/schema.ts`. All tables include `organization_id`. Workers import schemas from domain packages.

**Commit:**
```bash
git add workers/campaign/ workers/content/ workers/analytics/ workers/integrations/ && git commit -m "feat: add Campaign, Content, Analytics, and Integrations Worker skeletons"
```

---

### Task 17: Create Fly.io Service Skeletons

Same structure as v2 but with updated deps:
- `services/journey-executor/` — imports process-lib, journey-domain
- `services/delivery-engine/` — imports process-lib, delivery-domain
- `services/analytics-aggregator/` — imports process-lib, analytics-domain

All Dockerfiles use multi-stage Node.js 22 build with pnpm. All include health check endpoints. All fly.toml configs include Neon pooler URL and Redis URL as secrets.

**Commit:**
```bash
git add services/ && git commit -m "feat: add Fly.io service skeletons with Neon pooler and Redis connections"
```

---

### Task 18: Set Up CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

CI: typecheck, lint, test on PRs.
Deploy: wrangler deploy for Workers, fly deploy for services. Triggered on push to main.

**Commit:**
```bash
git add .github/ && git commit -m "feat: add CI/CD pipelines for CF Workers and Fly.io services"
```

---

### Task 19: Wire Gateway ↔ Identity ↔ Billing Service Bindings

Configure wrangler.toml service bindings between Gateway, Identity, and Billing Workers. Test auth flow end-to-end:
1. Gateway receives request
2. Calls Identity Worker → validates session
3. Returns user + org + plan
4. Gateway builds TenantContext
5. Proxies to appropriate domain Worker with X-Tenant-Context header

**Commit:**
```bash
git add workers/gateway/ workers/identity/ workers/billing/ && git commit -m "feat: wire Gateway, Identity, and Billing service bindings with tenant context propagation"
```

---

### Task 20: Onboarding Flow (SaaS)

Implement the signup → create org → select plan flow:
1. `/app/signup` — Better Auth signup page (HTMX)
2. After signup, redirect to `/app/onboarding`
3. `/app/onboarding/org` — Create organization (name, logo)
4. `/app/onboarding/plan` — Select plan (Free default, upgrade options)
5. If paid plan selected → Stripe Checkout → return to `/app/onboarding/setup`
6. `/app/onboarding/setup` — Add sending domain, configure provider, import contacts
7. Redirect to `/app/dashboard` on completion

**Commit:**
```bash
git add workers/gateway/ workers/identity/ workers/billing/ packages/domains/identity-domain/ && git commit -m "feat: add SaaS onboarding flow (signup → create org → select plan → guided setup)"
```

---

## Phase 1: Define All Contracts + Events (Tasks 21-28)

### Task 21: Complete CRM Contracts
- Add segments, companies, fields, tags, stages, categories endpoints
- All paths use `/api/v1/crm/` prefix

### Task 22: Complete Journey Contracts
- Journey CRUD, step management, trigger configuration, execution monitoring
- Journey analytics endpoints (conversion rates, drop-off points)
- All paths use `/api/v1/journey/` prefix

### Task 23: Complete Delivery Contracts
- Template CRUD, send API, tracking endpoints, suppression management, warmup management, provider management
- All paths use `/api/v1/delivery/` prefix

### Task 24: Campaign Contracts
- Campaign CRUD, blast send, scheduling, point system
- All paths use `/api/v1/campaign/` prefix

### Task 25: Content Contracts
- Forms, pages, assets, dynamic content CRUD + submission/tracking endpoints
- All paths use `/api/v1/content/` prefix

### Task 26: Analytics + Integrations Contracts
- Reports, widgets, webhooks, sync jobs, integration configs
- All paths use `/api/v1/analytics/` and `/api/v1/integrations/` prefix

### Task 27: Identity + Billing Contracts (expand)
- Users CRUD, roles, permissions, organizations, org members, invites, org switching
- Billing: plans, subscriptions, usage, portal, webhook
- All paths use `/api/v1/` prefix

### Task 28: Define All Domain Events with Version Field
- Ensure every event has `version: 1` in metadata
- Include `tenantContext.organizationId` in all event data
- Document event evolution rules in contracts package README

---

## Phase 2: Identity + Billing Context (Tasks 29-35)

### Task 29: Implement identity-domain package
- User entity with aggregate invariants (email required, role validation)
- Organization entity with invariants (name required, owner required)
- Repository interfaces (all accept organizationId where applicable)

### Task 30: Complete Identity schema and migrations
- Drizzle schema in `packages/domains/identity-domain/drizzle/schema.ts`
- Run drizzle-kit generate → migrate

### Task 31: Implement user CRUD with full DDD layers
- Commands: CreateUser, UpdateUser, BlockUser
- Queries: GetUser, ListUsers
- Application services orchestrate with Better Auth

### Task 32: Implement organization management
- Commands: CreateOrg, UpdateOrg, InviteMember, RemoveMember, ChangeRole
- Org switching: store active org in session
- Org invite flow with email tokens

### Task 33: Implement billing-domain entities and services
- Subscription aggregate (invariants: can't downgrade during trial, can't create duplicate)
- QuotaChecker domain service
- UsageRecord tracking

### Task 34: Implement Stripe integration
- Webhook handler: `invoice.paid`, `payment_failed`, `subscription.updated/deleted`
- Checkout session creation for upgrades
- Billing portal link generation
- Monthly usage reset scheduled job

### Task 35: Wire Gateway ↔ Identity ↔ Billing with full auth flow
- End-to-end test: signup → create org → subscribe → authenticated request → quota check

---

## Phase 3: CRM Context (Tasks 36-46)

### Task 36: Implement crm-domain package entities (Contact, Company, Segment)
- Contact aggregate with invariants (email format, org-scoped uniqueness)
- All entities include organizationId

### Task 37: Implement crm-domain repository interfaces
- All queries scoped by organizationId
- Bulk operations for import (with quota check)

### Task 38: Implement crm-domain commands and queries
- CreateContact, UpdateContact, MergeContacts, ImportContacts
- All commands accept TenantContext
- ImportContacts calls BillingService.checkQuota('contacts', count) before import

### Task 39: Implement Drizzle repositories in workers/crm/
- Import schema from `@mauntic/crm-domain/drizzle`
- All queries include `WHERE organization_id = ?`

### Task 40: Implement Contact CRUD API handlers

### Task 41: Implement Company aggregate

### Task 42: Implement Segment aggregate with filter engine

### Task 43: Implement custom Fields system

### Task 44: Implement Tags, DoNotContact, Stages

### Task 45: Wire CRM event publishing to Queues
- Publish ContactCreated, ContactUpdated, etc. with tenantContext in metadata

### Task 46: Build HTMX UI for contacts (list, detail, create, edit)

---

## Phase 4: Delivery Context (Tasks 47-62)

### Task 47: Implement delivery-domain entities
- DeliveryJob (with idempotencyKey)
- ProviderConfig (with encrypted credentials)
- Template, SuppressionEntry, WarmupSchedule, SendingIp
- All entities include organizationId

### Task 48: Implement delivery-domain repository interfaces
- All queries scoped by organizationId
- SuppressionRepository.isBlocked(orgId, email/phone, channel)

### Task 49: Implement delivery-domain commands
- SendMessage command (critical path): check suppression → check warmup → check quota → resolve provider → render template → call provider.send() → record attempt → publish event
- ConfigureProvider, AddSuppression, ProcessTrackingEvent commands

### Task 50: Implement SES email provider adapter

File: `packages/domains/delivery-domain/src/providers/ses.provider.ts`

HTTP-based — runs on both CF Workers and Fly.io.

### Task 51: Implement SendGrid email provider adapter

File: `packages/domains/delivery-domain/src/providers/sendgrid.provider.ts`

### Task 52: Implement Twilio SMS provider adapter

File: `packages/domains/delivery-domain/src/providers/twilio.provider.ts`

### Task 53: Implement Firebase push provider adapter

File: `packages/domains/delivery-domain/src/providers/fcm.provider.ts`

### Task 54: Implement generic SMTP provider adapter

File: `services/delivery-engine/src/providers/smtp.provider.ts`

TCP-based — Fly.io only.

### Task 55: Implement template rendering engine

File: `packages/domains/delivery-domain/src/services/template-renderer.ts`

Handlebars or Liquid template rendering with contact data interpolation. XSS sanitization on output.

### Task 56: Implement per-org suppression list management

### Task 57: Implement per-org warmup schedule management

### Task 58: Implement secrets encryption for provider configs

File: `packages/domains/delivery-domain/src/value-objects/encrypted-config.ts`

AES-256-GCM encryption for provider API keys stored in DB.

### Task 59: Implement Drizzle repositories in workers/delivery/
- Import schema from `@mauntic/delivery-domain/drizzle`

### Task 60: Implement Delivery API handlers (workers/delivery/)

### Task 61: Implement Delivery Engine BullMQ worker (services/delivery-engine/)
- Idempotent message processing
- Batch splitting, suppression check, warmup check, quota check, provider routing
- Exponential backoff retries

### Task 62: Implement tracking webhook handlers
- Parse webhooks from SES, SendGrid, Twilio
- HMAC signature verification
- Convert to TrackingEvents, update DeliveryJob status, publish domain events

---

## Phase 5: Journey Context (Tasks 63-77)

### Task 63: Implement journey-domain entities
- Journey aggregate root with invariant enforcement (cannot publish with 0 steps/triggers)
- JourneyVersion (immutable)
- JourneyStep, JourneyTrigger
- JourneyExecution, StepExecution
- All entities include organizationId

### Task 64: Implement journey-domain value objects
- Step-specific configs: ActionEmailConfig, DelayDurationConfig, SplitRandomConfig, etc.
- Trigger configs: EventTriggerConfig, SegmentTriggerConfig, ApiTriggerConfig

### Task 65: Implement journey-domain repository interfaces

### Task 66: Implement journey-domain commands
- CreateJourney, UpdateJourney, PublishJourney, PauseJourney
- StartExecution, ExecuteStep
- All commands check quotas (journeys limit)

### Task 67: Implement journey versioning
- Publishing creates immutable JourneyVersion
- In-flight executions pinned to their version

### Task 68: Implement step executor application service

File: `packages/domains/journey-domain/src/application/step-executor.ts`

Core orchestration: given a step and execution context, determine what to do:
- ActionStep → publish SendMessage to Delivery
- DelayStep → schedule delayed job
- SplitStep → evaluate condition via SplitEvaluator (domain service), pick branch
- GateStep → register event listener
- ExitStep → complete execution

### Task 69: Implement split evaluator domain service

File: `packages/domains/journey-domain/src/services/split-evaluator.ts`

Pure domain logic: evaluates conditional splits against contact data snapshot.

### Task 70: Implement CRM ACL for Journey context

File: `packages/domains/journey-domain/src/acl/crm-translator.ts`

Translates CRM events (ContactCreated, SegmentRebuilt) into Journey domain language.

### Task 71: Implement Drizzle schema and repositories in workers/journey/
- Import schema from `@mauntic/journey-domain/drizzle`

### Task 72: Implement Journey API handlers (workers/journey/)

### Task 73: Implement Journey HTMX UI
- Journey builder with drag-and-drop steps, visual flow editor

### Task 74: Implement Journey Executor BullMQ workers (services/journey-executor/)
- `journey-execute-step` queue: process individual steps (idempotent)
- `journey-delayed-steps` queue: handle delay wake-ups
- `journey-gate-listeners` queue: handle gate event matching

### Task 75: Implement journey event handlers
- `ContactCreated` → check segment triggers (via ACL)
- `FormSubmitted` → check event triggers
- `EmailOpened` → check gate conditions

### Task 76: Wire Journey ↔ Delivery via events
- End-to-end: trigger journey → execute email step → Delivery sends → tracking event flows back

### Task 77: Implement scheduled jobs for Journey
- Segment trigger evaluation (BullMQ repeatable, hourly)
- Stale execution cleanup (daily)

---

## Phase 6: Campaign Context (Tasks 78-81)

### Task 78: Implement campaign-domain package
### Task 79: Implement Campaign CRUD and blast sends (with quota check)
### Task 80: Implement point system
### Task 81: Wire Campaign → Delivery for sending

---

## Phase 7: Content Context (Tasks 82-87)

### Task 82: Implement content-domain package
### Task 83: Implement Form builder + submission processing
### Task 84: Implement Landing page builder (with XSS sanitization)
### Task 85: Implement Asset management with R2 (org-scoped buckets/prefixes)
### Task 86: Implement Dynamic content engine
### Task 87: Build HTMX form/page builder UI

---

## Phase 8: Analytics & Integrations (Tasks 88-97)

### Task 88: Implement analytics-domain package
### Task 89: Implement Report engine
### Task 90: Implement Dashboard widgets
### Task 91: Implement Analytics Aggregator on Fly.io (services/analytics-aggregator/)
- Pre-aggregation hourly job (materialized summaries per org)
- Heavy query execution with connection pooling
### Task 92: Implement integrations-domain package
### Task 93: Implement Webhook dispatch engine
- Exponential backoff retry: 1min, 5min, 30min, 2hr, 12hr
- Disable webhook after 5 consecutive failures, notify org admin
### Task 94: Implement third-party CRM sync (Salesforce/HubSpot patterns)
### Task 95: Implement Segment/PostHog integration
### Task 96: Implement scheduled analytics jobs
- Hourly event aggregation (BullMQ repeatable)
- Daily report generation
- Monthly usage summary per org
### Task 97: Implement warmup daily reset scheduled job
- BullMQ repeatable job: reset daily send counters per warmup schedule

---

## Phase 9: Mail Infrastructure (Tasks 98-104)

### Task 98: Set up Postfix Docker container
- Postfix config with DKIM, SPF, TLS, per-IP rate limiting

### Task 99: Set up Dovecot for bounce processing

### Task 100: Set up Rspamd for spam scoring

### Task 101: Implement sidecar API
- `POST /api/send` — accept email payload, inject into Postfix queue
- `GET /api/domains` — list configured sending domains (per-org)
- `POST /api/domains/verify` — initiate DNS verification
- `GET /api/ips` — list sending IPs
- `GET /api/health`

### Task 102: Implement domain verification and DNS management (per-org)

### Task 103: Implement multi-IP management
- Multiple IPs per org/domain
- Round-robin / weighted rotation
- Per-IP warmup tracking
- Auto-failover on delivery issues

### Task 104: Implement PostfixEmailProvider adapter

File: `services/delivery-engine/src/providers/postfix.provider.ts`

Connect Delivery Engine to Mail Infra via Fly.io internal network.

---

## Phase 10: Observability & Security Hardening (Tasks 105-112)

### Task 105: Implement structured logging across all Workers and services
- pino logger in every Worker (via worker-lib middleware)
- pino logger in every Fly.io service
- Include requestId, organizationId, userId in every log line

### Task 106: Implement distributed tracing
- Gateway generates X-Request-Id
- Propagated to Service Bindings, Queue messages, Fly.io HTTP calls, BullMQ jobs
- correlationId in all domain events

### Task 107: Implement DLQ monitoring
- Dashboard showing DLQ depth per queue
- Alert on DLQ > 0 (Slack webhook or email)
- DLQ replay tool (manual)

### Task 108: Implement circuit breaker for Fly.io calls
- Circuit breaker in worker-lib used for all CF Worker → Fly.io HTTP calls
- KV-backed state tracking

### Task 109: Implement tenant isolation audit
- Automated test suite that:
  1. Creates two test organizations
  2. Creates data in both
  3. Verifies Org A cannot see Org B's data
  4. Verifies RLS blocks direct SQL cross-tenant access

### Task 110: Implement CSRF protection
- Gateway generates per-session CSRF token in KV
- HTMX configured with `hx-headers='{"X-CSRF-Token": "..."}'`
- Middleware validates on all mutating requests

### Task 111: Implement Content-Security-Policy headers
- CSP headers on all responses from Gateway
- Prevent inline scripts, restrict frame ancestors

### Task 112: Implement API key auth for Enterprise plans
- API keys stored hashed in Identity schema
- Rate-limited separately from session auth
- Exempt from CSRF (stateless)

---

## Phase 11: Polish & Migration (Tasks 113-118)

### Task 113: Data migration scripts (Mautic MySQL → Neon Postgres)
- Map Mautic tables to new schema (with org_id assignment)
- Create default organization for migrated data
- Migrate users, contacts, campaigns, emails, forms, pages, assets
- Validate row counts post-migration

### Task 114: End-to-end testing
- Full journey flow: create contact → trigger journey → execute email step → delivery → tracking
- Multi-tenant isolation tests
- Quota enforcement tests
- Onboarding flow test

### Task 115: Performance optimization
- Query profiling with EXPLAIN ANALYZE
- Index verification
- KV cache hit rates
- Connection pool tuning
- R2 CDN cache headers for static assets

### Task 116: Scheduled job verification
- Verify all BullMQ repeatable jobs are registered:
  - Hourly: event aggregation, segment trigger evaluation
  - Daily: warmup reset, stale execution cleanup, report generation
  - Monthly: usage reset, usage summary

### Task 117: CI/CD pipeline finalization
- Staging environment (separate Neon branch, separate CF Workers)
- Production deployment with zero-downtime (Wrangler gradual rollout)
- Fly.io blue-green deployment

### Task 118: Documentation and deployment guide
- Architecture overview
- Local dev setup instructions
- Deployment checklist
- Environment variables reference
- API documentation (auto-generated from ts-rest contracts)
