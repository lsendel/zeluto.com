# Mauntic3 Migration Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite Mautic + Parcelvoy + BillionMail as a unified TypeScript marketing platform on Cloudflare Workers + Fly.io with DDD architecture.

**Architecture:** Dual-tier deployment — Cloudflare Workers at the edge for API/UI/light processing, Fly.io machines for heavy compute (journey execution, bulk sends, analytics, mail server). Domain logic lives in shared packages (`packages/domains/*`), deployed to either tier via different entry points. 10 bounded contexts, contract-first with ts-rest.

**Tech Stack:** Hono, ts-rest, Zod, Drizzle ORM, Better Auth, Cloudflare Workers/R2/Queues/KV/Hyperdrive, Fly.io, BullMQ, Redis, Postfix/Dovecot/Rspamd, Turborepo, pnpm, HTMX, Hono JSX, Tailwind CSS

**Design Doc:** `docs/plans/2026-02-12-mauntic-migration-design.md` (v2)

**Auth Reference:** `/Users/lsendel/Projects/knowledge-management-tool`

**Journey Reference:** [Parcelvoy](https://github.com/parcelvoy/platform)

**Mail Reference:** [BillionMail](https://github.com/Billionmail/BillionMail)

---

## Phase 0: Foundation (Tasks 1-15)

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
    "./types": { "import": "./dist/types/index.js", "types": "./dist/types/index.d.ts" }
  },
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

**Step 2: Create branded IDs**

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

export const ContactIdSchema = z.number().int().positive() as z.ZodType<ContactId>;
export const CompanyIdSchema = z.number().int().positive() as z.ZodType<CompanyId>;
export const CampaignIdSchema = z.number().int().positive() as z.ZodType<CampaignId>;
export const JourneyIdSchema = z.number().int().positive() as z.ZodType<JourneyId>;
export const DeliveryJobIdSchema = z.string().uuid() as z.ZodType<DeliveryJobId>;
// ... remaining schemas follow same pattern
```

**Step 3: Create domain events including journey + delivery events**

File: `packages/domain-kernel/src/events/domain-event.ts`

```typescript
export interface DomainEventMetadata {
  sourceContext: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
}

export interface DomainEvent<TType extends string = string, TData = unknown> {
  type: TType;
  data: TData;
  metadata: DomainEventMetadata;
}

// CRM Events
export interface ContactCreatedEvent extends DomainEvent<'ContactCreated', { contactId: number }> {}
export interface ContactUpdatedEvent extends DomainEvent<'ContactUpdated', { contactId: number; fields: string[] }> {}
export interface ContactMergedEvent extends DomainEvent<'ContactMerged', { winnerId: number; loserId: number }> {}
export interface SegmentRebuiltEvent extends DomainEvent<'SegmentRebuilt', { segmentId: number; contactCount: number }> {}

// Journey Events (from Parcelvoy)
export interface JourneyPublishedEvent extends DomainEvent<'JourneyPublished', { journeyId: number; versionId: number }> {}
export interface JourneyStepExecutedEvent extends DomainEvent<'JourneyStepExecuted', { journeyId: number; stepId: string; contactId: number; stepType: string }> {}
export interface JourneyCompletedEvent extends DomainEvent<'JourneyCompleted', { journeyId: number; executionId: string; contactId: number }> {}
export interface ExecuteNextStepEvent extends DomainEvent<'ExecuteNextStep', { executionId: string; stepId: string }> {}

// Delivery Events (from BillionMail + Parcelvoy)
export interface SendMessageEvent extends DomainEvent<'SendMessage', { channel: Channel; contactId: number; templateId: number; journeyExecutionId?: string; campaignId?: number }> {}
export interface EmailSentEvent extends DomainEvent<'EmailSent', { deliveryJobId: string; contactId: number; provider: string }> {}
export interface EmailOpenedEvent extends DomainEvent<'EmailOpened', { deliveryJobId: string; contactId: number }> {}
export interface EmailClickedEvent extends DomainEvent<'EmailClicked', { deliveryJobId: string; contactId: number; url: string }> {}
export interface EmailBouncedEvent extends DomainEvent<'EmailBounced', { deliveryJobId: string; contactId: number; bounceType: 'hard' | 'soft'; reason: string }> {}
export interface SmsSentEvent extends DomainEvent<'SmsSent', { deliveryJobId: string; contactId: number; provider: string }> {}
export interface PushSentEvent extends DomainEvent<'PushSent', { deliveryJobId: string; contactId: number; provider: string }> {}

// Campaign Events
export interface CampaignSentEvent extends DomainEvent<'CampaignSent', { campaignId: number; contactCount: number }> {}
export interface PointsAwardedEvent extends DomainEvent<'PointsAwarded', { contactId: number; points: number }> {}

// Content Events
export interface FormSubmittedEvent extends DomainEvent<'FormSubmitted', { formId: number; submissionId: number; contactId?: number }> {}
export interface PageVisitedEvent extends DomainEvent<'PageVisited', { pageId: number; contactId?: number }> {}
export interface AssetDownloadedEvent extends DomainEvent<'AssetDownloaded', { assetId: number; contactId?: number }> {}

// Identity Events
export interface UserCreatedEvent extends DomainEvent<'UserCreated', { userId: number }> {}

export type Channel = 'email' | 'sms' | 'push' | 'webhook';

export type AnyDomainEvent =
  | ContactCreatedEvent | ContactUpdatedEvent | ContactMergedEvent | SegmentRebuiltEvent
  | JourneyPublishedEvent | JourneyStepExecutedEvent | JourneyCompletedEvent | ExecuteNextStepEvent
  | SendMessageEvent | EmailSentEvent | EmailOpenedEvent | EmailClickedEvent | EmailBouncedEvent | SmsSentEvent | PushSentEvent
  | CampaignSentEvent | PointsAwardedEvent
  | FormSubmittedEvent | PageVisitedEvent | AssetDownloadedEvent
  | UserCreatedEvent;
```

**Step 4: Create DeliveryProvider interface**

File: `packages/domain-kernel/src/delivery/provider.ts`

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

**Step 5: Create index files, build, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/domain-kernel build
git add packages/domain-kernel/ && git commit -m "feat: add domain-kernel with value objects, events, and delivery provider interface"
```

---

### Task 3: Create contracts Package

Same as original plan Task 3, but add journey and delivery contract stubs:

**Additional files:**
- Create: `packages/contracts/src/journey.contract.ts`
- Create: `packages/contracts/src/delivery.contract.ts`

**Step 1-5:** Same as original plan (package.json, tsconfig, common schemas, identity contract, CRM contract)

**Step 6: Create journey contract stub**

File: `packages/contracts/src/journey.contract.ts`

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { PaginationQuerySchema, PaginatedResponseSchema, ErrorSchema, IdParamSchema } from './common';

const c = initContract();

export const JourneyStepTypeSchema = z.enum([
  'action_email', 'action_sms', 'action_push', 'action_webhook', 'action_update_contact',
  'delay_duration', 'delay_until', 'delay_event',
  'split_random', 'split_conditional', 'gate', 'exit',
]);

export const JourneySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'published', 'paused', 'archived']),
  currentVersionId: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyStepSchema = z.object({
  id: z.string(),
  type: JourneyStepTypeSchema,
  name: z.string(),
  config: z.record(z.unknown()),
  nextStepIds: z.array(z.string()),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const JourneyVersionSchema = z.object({
  id: z.number(),
  journeyId: z.number(),
  version: z.number(),
  steps: z.array(JourneyStepSchema),
  triggers: z.array(z.record(z.unknown())),
  publishedAt: z.string(),
});

export const CreateJourneySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const journeyContract = c.router({
  list: {
    method: 'GET',
    path: '/api/journey/journeys',
    query: PaginationQuerySchema,
    responses: { 200: PaginatedResponseSchema(JourneySchema) },
  },
  get: {
    method: 'GET',
    path: '/api/journey/journeys/:id',
    pathParams: IdParamSchema,
    responses: { 200: JourneySchema.extend({ versions: z.array(JourneyVersionSchema) }), 404: ErrorSchema },
  },
  create: {
    method: 'POST',
    path: '/api/journey/journeys',
    body: CreateJourneySchema,
    responses: { 201: JourneySchema, 400: ErrorSchema },
  },
  publish: {
    method: 'POST',
    path: '/api/journey/journeys/:id/publish',
    pathParams: IdParamSchema,
    body: z.object({ steps: z.array(JourneyStepSchema), triggers: z.array(z.record(z.unknown())) }),
    responses: { 200: JourneyVersionSchema, 400: ErrorSchema, 404: ErrorSchema },
  },
  pause: {
    method: 'POST',
    path: '/api/journey/journeys/:id/pause',
    pathParams: IdParamSchema,
    body: z.object({}).optional(),
    responses: { 200: JourneySchema, 404: ErrorSchema },
  },
  executions: {
    method: 'GET',
    path: '/api/journey/journeys/:id/executions',
    pathParams: IdParamSchema,
    query: PaginationQuerySchema,
    responses: { 200: PaginatedResponseSchema(z.object({
      id: z.string(),
      contactId: z.number(),
      currentStepId: z.string().nullable(),
      status: z.enum(['running', 'completed', 'failed', 'exited']),
      startedAt: z.string(),
      completedAt: z.string().nullable(),
    })) },
  },
});
```

**Step 7: Create delivery contract stub**

File: `packages/contracts/src/delivery.contract.ts`

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { PaginationQuerySchema, PaginatedResponseSchema, ErrorSchema, IdParamSchema } from './common';

const c = initContract();

export const ProviderConfigSchema = z.object({
  id: z.number(),
  channel: z.enum(['email', 'sms', 'push']),
  providerName: z.string(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  config: z.record(z.unknown()),
  createdAt: z.string(),
});

export const DeliveryJobSchema = z.object({
  id: z.string(),
  channel: z.enum(['email', 'sms', 'push']),
  contactId: z.number(),
  templateId: z.number(),
  providerName: z.string().nullable(),
  status: z.enum(['queued', 'sent', 'delivered', 'bounced', 'failed']),
  externalId: z.string().nullable(),
  attempts: z.number(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});

export const SuppressionEntrySchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  phone: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push']),
  reason: z.enum(['hard_bounce', 'complaint', 'unsubscribe', 'manual']),
  createdAt: z.string(),
});

export const WarmupScheduleSchema = z.object({
  id: z.number(),
  domain: z.string(),
  ipAddress: z.string().nullable(),
  currentDay: z.number(),
  dailyLimit: z.number(),
  sentToday: z.number(),
  isActive: z.boolean(),
});

export const deliveryContract = c.router({
  providers: {
    list: {
      method: 'GET',
      path: '/api/delivery/providers',
      responses: { 200: z.array(ProviderConfigSchema) },
    },
    create: {
      method: 'POST',
      path: '/api/delivery/providers',
      body: z.object({
        channel: z.enum(['email', 'sms', 'push']),
        providerName: z.string(),
        config: z.record(z.unknown()),
        isDefault: z.boolean().optional(),
      }),
      responses: { 201: ProviderConfigSchema, 400: ErrorSchema },
    },
    update: {
      method: 'PATCH',
      path: '/api/delivery/providers/:id',
      pathParams: IdParamSchema,
      body: z.object({ config: z.record(z.unknown()), isActive: z.boolean().optional(), isDefault: z.boolean().optional() }),
      responses: { 200: ProviderConfigSchema, 404: ErrorSchema },
    },
  },
  jobs: {
    list: {
      method: 'GET',
      path: '/api/delivery/jobs',
      query: PaginationQuerySchema.extend({ channel: z.enum(['email', 'sms', 'push']).optional(), status: z.string().optional() }),
      responses: { 200: PaginatedResponseSchema(DeliveryJobSchema) },
    },
  },
  suppressions: {
    list: {
      method: 'GET',
      path: '/api/delivery/suppressions',
      query: PaginationQuerySchema.extend({ channel: z.enum(['email', 'sms', 'push']).optional() }),
      responses: { 200: PaginatedResponseSchema(SuppressionEntrySchema) },
    },
    add: {
      method: 'POST',
      path: '/api/delivery/suppressions',
      body: z.object({ email: z.string().optional(), phone: z.string().optional(), channel: z.enum(['email', 'sms', 'push']), reason: z.enum(['manual']) }),
      responses: { 201: SuppressionEntrySchema },
    },
    remove: {
      method: 'DELETE',
      path: '/api/delivery/suppressions/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: { 204: z.void() },
    },
  },
  warmup: {
    list: {
      method: 'GET',
      path: '/api/delivery/warmup',
      responses: { 200: z.array(WarmupScheduleSchema) },
    },
    create: {
      method: 'POST',
      path: '/api/delivery/warmup',
      body: z.object({ domain: z.string(), ipAddress: z.string().optional() }),
      responses: { 201: WarmupScheduleSchema },
    },
  },
  tracking: {
    webhook: {
      method: 'POST',
      path: '/api/delivery/tracking/:provider',
      body: z.any(),
      responses: { 200: z.object({ received: z.boolean() }) },
    },
  },
});
```

**Step 8: Update root index, build, commit**

File: `packages/contracts/src/index.ts`

```typescript
export { identityContract, UserSchema } from './identity.contract';
export { crmContract, ContactSchema, CreateContactSchema, UpdateContactSchema } from './crm.contract';
export { journeyContract, JourneySchema, JourneyStepSchema, JourneyVersionSchema } from './journey.contract';
export { deliveryContract, ProviderConfigSchema, DeliveryJobSchema, SuppressionEntrySchema, WarmupScheduleSchema } from './delivery.contract';
export { PaginationQuerySchema, PaginatedResponseSchema, ErrorSchema, IdParamSchema } from './common';
```

```bash
pnpm install && pnpm --filter @mauntic/contracts build
git add packages/contracts/ && git commit -m "feat: add contracts with journey, delivery, CRM, and identity ts-rest contracts"
```

---

### Task 4: Create worker-lib Package

Same as original plan Task 4. No changes needed.

---

### Task 5: Create process-lib Package (NEW)

**Files:**
- Create: `packages/process-lib/package.json`
- Create: `packages/process-lib/tsconfig.json`
- Create: `packages/process-lib/src/index.ts`
- Create: `packages/process-lib/src/bullmq/job-processor.ts`
- Create: `packages/process-lib/src/redis/connection.ts`
- Create: `packages/process-lib/src/scheduler/cron.ts`
- Create: `packages/process-lib/src/health/server.ts`

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
    "./health": { "import": "./dist/health/server.js", "types": "./dist/health/server.d.ts" }
  },
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

**Step 2: Create Redis connection helper**

File: `packages/process-lib/src/redis/connection.ts`

```typescript
import Redis from 'ioredis';

let redisInstance: Redis | null = null;

export function getRedis(url?: string): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(url ?? process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return redisInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
```

**Step 3: Create BullMQ job processor base**

File: `packages/process-lib/src/bullmq/job-processor.ts`

```typescript
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
    async (job) => handler.process(job),
    {
      connection: getRedis(),
      concurrency: handler.concurrency ?? 5,
    },
  );
}
```

**Step 4: Create health check server**

File: `packages/process-lib/src/health/server.ts`

```typescript
import { createServer } from 'node:http';

export function startHealthServer(port = 8080): void {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => console.log(`Health server on :${port}`));
}
```

**Step 5: Create index, build, commit**

```typescript
// packages/process-lib/src/index.ts
export { createQueue, createWorker, type JobHandler } from './bullmq/job-processor';
export { getRedis, closeRedis } from './redis/connection';
export { startHealthServer } from './health/server';
```

```bash
pnpm install && pnpm --filter @mauntic/process-lib build
git add packages/process-lib/ && git commit -m "feat: add process-lib with BullMQ, Redis, and health check utilities for Fly.io"
```

---

### Task 6: Create ui-kit Package

Same as original plan Task 5. No changes.

---

### Task 7: Create Domain Packages Structure (NEW)

Create the empty domain package scaffolding for all 8 domain contexts.

**Files:** Create package.json, tsconfig.json, and src/ directory for each:
- `packages/domains/identity-domain/`
- `packages/domains/crm-domain/`
- `packages/domains/journey-domain/`
- `packages/domains/campaign-domain/`
- `packages/domains/delivery-domain/`
- `packages/domains/content-domain/`
- `packages/domains/analytics-domain/`
- `packages/domains/integrations-domain/`

**Step 1: Create a template package.json** (repeat for each domain)

```json
{
  "name": "@mauntic/crm-domain",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc", "typecheck": "tsc --noEmit", "test": "vitest" },
  "dependencies": {
    "@mauntic/domain-kernel": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0" }
}
```

**Step 2: Create directory structure for each** (using crm-domain as example)

```
packages/domains/crm-domain/src/
├── entities/         # .gitkeep
├── value-objects/    # .gitkeep
├── events/           # .gitkeep
├── repositories/     # .gitkeep
├── services/         # .gitkeep
├── commands/         # .gitkeep
├── queries/          # .gitkeep
├── event-handlers/   # .gitkeep
└── index.ts          # export {}
```

**Step 3: Commit**

```bash
git add packages/domains/ && git commit -m "feat: scaffold 8 domain packages with DDD directory structure"
```

---

### Task 8: Create Gateway Worker

Same as original plan Task 6, with updated Service Binding stubs for Journey and Delivery Workers.

---

### Task 9: Create Identity Worker

Same as original plan Task 7. Port Better Auth from KMT.

---

### Task 10: Create CRM Worker Skeleton

Same as original plan Task 8, but domain logic goes in `packages/domains/crm-domain/` and Workers only contain infrastructure + interface.

**Key difference from original plan:** The domain entities, repositories, and commands/queries live in `packages/domains/crm-domain/src/`. The Worker at `workers/crm/src/` only has `infrastructure/` (Drizzle repos, queue publishers) and `interface/` (Hono routes, HTMX partials).

---

### Task 11: Create Journey Worker Skeleton (NEW)

**Files:**
- Create: `workers/journey/package.json`
- Create: `workers/journey/tsconfig.json`
- Create: `workers/journey/wrangler.toml`
- Create: `workers/journey/src/app.ts`
- Create: `workers/journey/src/index.ts`
- Create: `workers/journey/drizzle/schema.ts`

**Step 1:** Follow same pattern as CRM Worker skeleton. Drizzle schema uses `pgSchema('journey')` with tables: journeys, journey_versions, journey_steps, journey_triggers, journey_executions, step_executions, execution_logs.

**Step 2: Commit**

```bash
git add workers/journey/ && git commit -m "feat: add Journey Worker skeleton with DDD structure"
```

---

### Task 12: Create Delivery Worker Skeleton (NEW)

**Files:**
- Create: `workers/delivery/package.json`
- Create: `workers/delivery/tsconfig.json`
- Create: `workers/delivery/wrangler.toml`
- Create: `workers/delivery/src/app.ts`
- Create: `workers/delivery/src/index.ts`
- Create: `workers/delivery/drizzle/schema.ts`

Drizzle schema uses `pgSchema('delivery')` with tables: delivery_jobs, delivery_attempts, provider_configs, email_templates, sms_templates, push_templates, tracking_events, suppression_list, warmup_schedules, warmup_days, sending_ips.

```bash
git add workers/delivery/ && git commit -m "feat: add Delivery Worker skeleton with provider config and suppression schemas"
```

---

### Task 13: Create Remaining Worker Skeletons

Create Campaign, Content, Analytics, and Integrations Workers following the same pattern.

---

### Task 14: Create Fly.io Service Skeletons (NEW)

**Files:**
- Create: `services/journey-executor/package.json`
- Create: `services/journey-executor/tsconfig.json`
- Create: `services/journey-executor/Dockerfile`
- Create: `services/journey-executor/fly.toml`
- Create: `services/journey-executor/src/worker.ts`
- Create: `services/delivery-engine/` (same structure)
- Create: `services/analytics-aggregator/` (same structure)

**Step 1: Create journey-executor package.json**

```json
{
  "name": "@mauntic/journey-executor",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": { "start": "node dist/worker.js", "build": "tsc", "dev": "tsx watch src/worker.ts" },
  "dependencies": {
    "@mauntic/process-lib": "workspace:*",
    "@mauntic/journey-domain": "workspace:*",
    "@mauntic/domain-kernel": "workspace:*",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "tsx": "^4.0.0" }
}
```

**Step 2: Create Dockerfile**

```dockerfile
FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY services/journey-executor/ services/journey-executor/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mauntic/journey-executor build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/services/journey-executor/dist dist
COPY --from=build /app/services/journey-executor/package.json .
EXPOSE 8080
CMD ["node", "dist/worker.js"]
```

**Step 3: Create fly.toml**

```toml
app = "mauntic-journey-executor"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

**Step 4: Create worker.ts stub**

File: `services/journey-executor/src/worker.ts`

```typescript
import { createWorker, startHealthServer, getRedis } from '@mauntic/process-lib';

console.log('Starting Journey Executor...');
startHealthServer(8080);

// TODO: Implement journey step execution workers in Phase 5
// const stepWorker = createWorker('journey-steps', { ... });

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  // await stepWorker.close();
  process.exit(0);
});
```

**Step 5: Repeat for delivery-engine and analytics-aggregator, then commit**

```bash
git add services/ && git commit -m "feat: add Fly.io service skeletons (journey-executor, delivery-engine, analytics-aggregator)"
```

---

### Task 15: Set Up CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

CI: typecheck, lint, test on PRs. Deploy: wrangler deploy for Workers, fly deploy for services. Triggered on push to main.

```bash
git add .github/ && git commit -m "feat: add CI/CD pipelines for CF Workers and Fly.io services"
```

---

## Phase 1: Define All Contracts (Tasks 16-22)

Map every Mautic API endpoint to ts-rest contracts. Reference: `/Users/lsendel/Projects/mauntic/app/bundles/*/Controller/Api/*Controller.php`

### Task 16: Complete CRM Contracts
- Add segments, companies, fields, tags, stages, categories endpoints to `packages/contracts/src/crm.contract.ts`

### Task 17: Complete Journey Contracts
- Add journey CRUD, step management, trigger configuration, execution monitoring
- Add journey analytics endpoints (conversion rates, drop-off points)

### Task 18: Complete Delivery Contracts
- Add template CRUD, send API, tracking endpoints, suppression management, warmup management, provider management

### Task 19: Campaign Contracts
- Campaign CRUD, blast send, scheduling, point system

### Task 20: Content Contracts
- Forms, pages, assets, dynamic content CRUD + submission/tracking endpoints

### Task 21: Analytics + Integrations Contracts
- Reports, widgets, webhooks, sync jobs, integration configs

### Task 22: Identity Contracts (expand)
- Users CRUD, roles, permissions, organizations, org members

---

## Phase 2: Identity Context (Tasks 23-27)

### Task 23: Implement identity-domain package
### Task 24: Complete Identity schema and migrations
### Task 25: Implement user CRUD with full DDD layers
### Task 26: Implement organization management
### Task 27: Wire Gateway <-> Identity Service Binding

---

## Phase 3: CRM Context (Tasks 28-38)

### Task 28: Implement crm-domain package entities (Contact, Company, Segment)
### Task 29: Implement crm-domain repository interfaces
### Task 30: Implement crm-domain commands and queries
### Task 31: Implement Drizzle repositories in workers/crm/
### Task 32: Implement Contact CRUD API handlers
### Task 33: Implement Company aggregate
### Task 34: Implement Segment aggregate with filter engine
### Task 35: Implement custom Fields system
### Task 36: Implement Tags, DoNotContact, Stages
### Task 37: Wire CRM event publishing to Queues
### Task 38: Build HTMX UI for contacts (list, detail, create, edit)

---

## Phase 4: Delivery Context (Tasks 39-52)

### Task 39: Implement delivery-domain entities

**Files:**
- Create: `packages/domains/delivery-domain/src/entities/delivery-job.ts`
- Create: `packages/domains/delivery-domain/src/entities/provider-config.ts`
- Create: `packages/domains/delivery-domain/src/entities/template.ts`
- Create: `packages/domains/delivery-domain/src/entities/suppression-entry.ts`
- Create: `packages/domains/delivery-domain/src/entities/warmup-schedule.ts`
- Create: `packages/domains/delivery-domain/src/entities/sending-ip.ts`

### Task 40: Implement delivery-domain repository interfaces

**Files:**
- Create: `packages/domains/delivery-domain/src/repositories/delivery-job.repository.ts`
- Create: `packages/domains/delivery-domain/src/repositories/provider-config.repository.ts`
- Create: `packages/domains/delivery-domain/src/repositories/suppression.repository.ts`
- Create: `packages/domains/delivery-domain/src/repositories/warmup.repository.ts`

### Task 41: Implement delivery-domain commands

**Files:**
- Create: `packages/domains/delivery-domain/src/commands/send-message.command.ts`
- Create: `packages/domains/delivery-domain/src/commands/configure-provider.command.ts`
- Create: `packages/domains/delivery-domain/src/commands/add-suppression.command.ts`
- Create: `packages/domains/delivery-domain/src/commands/process-tracking-event.command.ts`

The `send-message.command.ts` is the critical path:
1. Check suppression list
2. Check warmup limits
3. Resolve provider from config
4. Render template with contact data
5. Call `provider.send()`
6. Record DeliveryAttempt
7. Publish delivery event

### Task 42: Implement SES email provider adapter

**Files:**
- Create: `services/delivery-engine/src/providers/ses.provider.ts`

### Task 43: Implement Twilio SMS provider adapter

**Files:**
- Create: `services/delivery-engine/src/providers/twilio.provider.ts`

### Task 44: Implement Firebase push provider adapter

**Files:**
- Create: `services/delivery-engine/src/providers/fcm.provider.ts`

### Task 45: Implement generic SMTP provider adapter

**Files:**
- Create: `services/delivery-engine/src/providers/smtp.provider.ts`

### Task 46: Implement template rendering engine

**Files:**
- Create: `packages/domains/delivery-domain/src/services/template-renderer.ts`

Handlebars or Liquid template rendering with contact data interpolation.

### Task 47: Implement suppression list management

### Task 48: Implement warmup schedule management

### Task 49: Implement Drizzle repositories in workers/delivery/

### Task 50: Implement Delivery API handlers (workers/delivery/)

### Task 51: Implement Delivery Engine BullMQ worker (services/delivery-engine/)

The bulk send engine on Fly.io:
- Consumes SendMessage jobs from BullMQ
- Splits batches, checks suppression, checks warmup
- Routes to provider adapter
- Handles retries with exponential backoff

### Task 52: Implement tracking webhook handlers

Handle inbound webhooks from SES, SendGrid, Twilio, etc. Parse into TrackingEvents, update DeliveryJob status, publish domain events.

---

## Phase 5: Journey Context (Tasks 53-65)

### Task 53: Implement journey-domain entities

**Files:**
- Create: `packages/domains/journey-domain/src/entities/journey.ts`
- Create: `packages/domains/journey-domain/src/entities/journey-version.ts`
- Create: `packages/domains/journey-domain/src/entities/journey-step.ts`
- Create: `packages/domains/journey-domain/src/entities/journey-trigger.ts`
- Create: `packages/domains/journey-domain/src/entities/journey-execution.ts`
- Create: `packages/domains/journey-domain/src/entities/step-execution.ts`

### Task 54: Implement journey-domain value objects

**Files:**
- Create: `packages/domains/journey-domain/src/value-objects/step-config.ts`
- Create: `packages/domains/journey-domain/src/value-objects/trigger-config.ts`

Define typed configs for each step type (ActionEmailConfig, DelayDurationConfig, SplitRandomConfig, etc.)

### Task 55: Implement journey-domain repository interfaces

### Task 56: Implement journey-domain commands
- CreateJourney, UpdateJourney, PublishJourney, PauseJourney
- StartExecution, ExecuteStep

### Task 57: Implement journey versioning
- Publishing creates immutable JourneyVersion
- In-flight executions pinned to their version

### Task 58: Implement step executor domain service

**Files:**
- Create: `packages/domains/journey-domain/src/services/step-executor.ts`

Core logic: given a step and execution context, determine what to do:
- ActionStep -> publish SendMessage to Delivery
- DelayStep -> schedule delayed job
- SplitStep -> evaluate condition, pick branch
- GateStep -> register event listener
- ExitStep -> complete execution

### Task 59: Implement split evaluator

**Files:**
- Create: `packages/domains/journey-domain/src/services/split-evaluator.ts`

Evaluates conditional splits against contact data (field comparisons, segment membership, etc.)

### Task 60: Implement Drizzle schema and repositories in workers/journey/

### Task 61: Implement Journey API handlers (workers/journey/)

### Task 62: Implement Journey HTMX UI

Journey builder with drag-and-drop steps, visual flow editor.

### Task 63: Implement Journey Executor BullMQ workers (services/journey-executor/)

**Files:**
- Modify: `services/journey-executor/src/worker.ts`

Create BullMQ workers for:
- `journey-execute-step` queue: process individual steps
- `journey-delayed-steps` queue: handle delay wake-ups
- `journey-gate-listeners` queue: handle gate event matching

### Task 64: Implement journey event handlers

Handle events from other contexts:
- `ContactCreated` -> check if any journeys have segment triggers
- `FormSubmitted` -> check for event triggers
- `EmailOpened` -> check for gate conditions

### Task 65: Wire Journey <-> Delivery via events

Test end-to-end: trigger journey -> execute email step -> Delivery sends -> tracking event flows back.

---

## Phase 6: Campaign Context (Tasks 66-69)

### Task 66: Implement campaign-domain package
### Task 67: Implement Campaign CRUD and blast sends
### Task 68: Implement point system
### Task 69: Wire Campaign -> Delivery for sending

---

## Phase 7: Content Context (Tasks 70-75)

### Task 70: Implement content-domain package
### Task 71: Implement Form builder + submission processing
### Task 72: Implement Landing page builder
### Task 73: Implement Asset management with R2
### Task 74: Implement Dynamic content engine
### Task 75: Build HTMX form/page builder UI

---

## Phase 8: Analytics & Integrations (Tasks 76-83)

### Task 76: Implement analytics-domain package
### Task 77: Implement Report engine
### Task 78: Implement Dashboard widgets
### Task 79: Implement Analytics Aggregator on Fly.io (services/analytics-aggregator/)
### Task 80: Implement integrations-domain package
### Task 81: Implement Webhook dispatch engine
### Task 82: Implement third-party CRM sync (Salesforce/HubSpot patterns)
### Task 83: Implement Segment/PostHog integration

---

## Phase 9: Mail Infrastructure (Tasks 84-90)

### Task 84: Set up Postfix Docker container

**Files:**
- Create: `services/mail-infra/docker/postfix/main.cf`
- Create: `services/mail-infra/docker/postfix/master.cf`
- Create: `services/mail-infra/docker-compose.yml`

Configure Postfix with DKIM signing, SPF, TLS, rate limiting.

### Task 85: Set up Dovecot for bounce processing

### Task 86: Set up Rspamd for spam scoring

### Task 87: Implement sidecar API

**Files:**
- Create: `services/mail-infra/src/api.ts`

Node.js Express/Hono API on Fly.io internal network:
- `POST /api/send` — accept email payload, inject into Postfix queue
- `GET /api/domains` — list configured sending domains
- `POST /api/domains/verify` — initiate DNS verification
- `GET /api/ips` — list sending IPs
- `GET /api/health` — health check

### Task 88: Implement domain verification and DNS management

### Task 89: Implement multi-IP management

- Multiple IPs per domain
- Round-robin / weighted rotation
- Per-IP warmup tracking
- Per-IP reputation monitoring
- Auto-failover on delivery issues

### Task 90: Implement PostfixEmailProvider adapter

**Files:**
- Create: `services/delivery-engine/src/providers/postfix.provider.ts`

Connect the Delivery Engine to Mail Infra via Fly.io internal network.

---

## Phase 10: Polish & Migration (Tasks 91-95)

### Task 91: Data migration scripts (Mautic MySQL -> Neon Postgres)
### Task 92: End-to-end testing (journey -> delivery -> tracking flow)
### Task 93: Performance optimization (caching, query tuning, connection pooling)
### Task 94: CI/CD pipeline finalization (staging -> production)
### Task 95: Documentation and deployment guide
