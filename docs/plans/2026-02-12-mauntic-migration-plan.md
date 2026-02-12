# Mauntic3 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite Mautic marketing automation platform as TypeScript micro-Workers on Cloudflare with DDD architecture.

**Architecture:** Contract-first micro-Workers per bounded context. Gateway Worker handles auth/routing/HTMX composition. Domain Workers (Identity, CRM, Campaign, Messaging, Content, Analytics, Integrations) communicate via Service Bindings (sync) and Cloudflare Queues (async events). Neon Postgres with separate schemas per context.

**Tech Stack:** Hono, ts-rest, Zod, Drizzle ORM, Better Auth, Cloudflare Workers/R2/Queues/KV/Hyperdrive, Turborepo, pnpm, HTMX, Hono JSX, Tailwind CSS

**Design Doc:** `docs/plans/2026-02-12-mauntic-migration-design.md`

**Auth Reference:** `/Users/lsendel/Projects/knowledge-management-tool` (Better Auth + Hono + ts-rest + Drizzle + CF Workers)

---

## Phase 0: Foundation (Tasks 1-12)

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
  - "workers/*"
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

**Step 5: Create .gitignore**

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

**Step 6: Create .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

**Step 7: Install root dev dependencies**

```bash
pnpm add -Dw turbo typescript @cloudflare/workers-types
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo with Turborepo and pnpm workspaces"
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
    "./types": { "import": "./dist/types/index.js", "types": "./dist/types/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create branded ID value object**

File: `packages/domain-kernel/src/value-objects/branded-id.ts`

```typescript
import { z } from 'zod';

// Branded type for type-safe IDs across contexts
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

// Zod schemas for validation at boundaries
export const ContactIdSchema = z.number().int().positive() as z.ZodType<ContactId>;
export const CompanyIdSchema = z.number().int().positive() as z.ZodType<CompanyId>;
export const CampaignIdSchema = z.number().int().positive() as z.ZodType<CampaignId>;
export const EmailIdSchema = z.number().int().positive() as z.ZodType<EmailId>;
export const FormIdSchema = z.number().int().positive() as z.ZodType<FormId>;
export const PageIdSchema = z.number().int().positive() as z.ZodType<PageId>;
export const AssetIdSchema = z.number().int().positive() as z.ZodType<AssetId>;
export const SegmentIdSchema = z.number().int().positive() as z.ZodType<SegmentId>;
export const UserIdSchema = z.number().int().positive() as z.ZodType<UserId>;
export const OrganizationIdSchema = z.number().int().positive() as z.ZodType<OrganizationId>;
export const WebhookIdSchema = z.number().int().positive() as z.ZodType<WebhookId>;
export const IntegrationIdSchema = z.number().int().positive() as z.ZodType<IntegrationId>;
export const ReportIdSchema = z.number().int().positive() as z.ZodType<ReportId>;
```

**Step 4: Create email address value object**

File: `packages/domain-kernel/src/value-objects/email-address.ts`

```typescript
import { z } from 'zod';

export const EmailAddressSchema = z.string().email().toLowerCase().brand('EmailAddress');
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
```

**Step 5: Create value-objects index**

File: `packages/domain-kernel/src/value-objects/index.ts`

```typescript
export * from './branded-id';
export * from './email-address';
```

**Step 6: Create domain event base type**

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
export interface ContactAddedToSegmentEvent extends DomainEvent<'ContactAddedToSegment', { contactId: number; segmentId: number }> {}

// Campaign Events
export interface CampaignPublishedEvent extends DomainEvent<'CampaignPublished', { campaignId: number }> {}
export interface CampaignEventExecutedEvent extends DomainEvent<'CampaignEventExecuted', { campaignId: number; eventId: number; contactId: number }> {}
export interface PointsAwardedEvent extends DomainEvent<'PointsAwarded', { contactId: number; points: number }> {}

// Messaging Events
export interface EmailSentEvent extends DomainEvent<'EmailSent', { emailId: number; contactId: number }> {}
export interface EmailOpenedEvent extends DomainEvent<'EmailOpened', { emailId: number; contactId: number }> {}
export interface EmailClickedEvent extends DomainEvent<'EmailClicked', { emailId: number; contactId: number; url: string }> {}
export interface EmailBouncedEvent extends DomainEvent<'EmailBounced', { emailId: number; contactId: number; reason: string }> {}

// Content Events
export interface FormSubmittedEvent extends DomainEvent<'FormSubmitted', { formId: number; submissionId: number }> {}
export interface PageVisitedEvent extends DomainEvent<'PageVisited', { pageId: number; contactId?: number }> {}
export interface AssetDownloadedEvent extends DomainEvent<'AssetDownloaded', { assetId: number; contactId?: number }> {}

// Identity Events
export interface UserCreatedEvent extends DomainEvent<'UserCreated', { userId: number }> {}

export type CrmEvent = ContactCreatedEvent | ContactUpdatedEvent | ContactMergedEvent | SegmentRebuiltEvent | ContactAddedToSegmentEvent;
export type CampaignEvent = CampaignPublishedEvent | CampaignEventExecutedEvent | PointsAwardedEvent;
export type MessagingEvent = EmailSentEvent | EmailOpenedEvent | EmailClickedEvent | EmailBouncedEvent;
export type ContentEvent = FormSubmittedEvent | PageVisitedEvent | AssetDownloadedEvent;
export type IdentityEvent = UserCreatedEvent;

export type AnyDomainEvent = CrmEvent | CampaignEvent | MessagingEvent | ContentEvent | IdentityEvent;
```

**Step 7: Create events index and types index**

File: `packages/domain-kernel/src/events/index.ts`
```typescript
export * from './domain-event';
```

File: `packages/domain-kernel/src/types/index.ts`
```typescript
export type { DomainEvent, DomainEventMetadata, AnyDomainEvent } from '../events/domain-event';
```

File: `packages/domain-kernel/src/index.ts`
```typescript
export * from './value-objects';
export * from './events';
export * from './types';
```

**Step 8: Install deps and build**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/domain-kernel build
```

**Step 9: Commit**

```bash
git add packages/domain-kernel/
git commit -m "feat: add domain-kernel package with value objects and domain events"
```

---

### Task 3: Create contracts Package

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/common.ts`
- Create: `packages/contracts/src/identity.contract.ts`
- Create: `packages/contracts/src/crm.contract.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ts-rest/core": "^3.51.0",
    "zod": "^3.23.0",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create common schemas**

File: `packages/contracts/src/common.ts`

```typescript
import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  orderBy: z.string().optional(),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
```

**Step 4: Create identity contract (stub)**

File: `packages/contracts/src/identity.contract.ts`

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema } from './common';

const c = initContract();

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'superadmin']),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});

export const identityContract = c.router({
  me: {
    method: 'GET',
    path: '/api/auth/me',
    responses: {
      200: UserSchema,
      401: ErrorSchema,
    },
  },
}, { pathPrefix: '' });

export { UserSchema };
```

**Step 5: Create CRM contract (stub with contacts)**

File: `packages/contracts/src/crm.contract.ts`

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { PaginationQuerySchema, PaginatedResponseSchema, ErrorSchema, IdParamSchema } from './common';

const c = initContract();

export const ContactSchema = z.object({
  id: z.number(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  position: z.string().nullable(),
  points: z.number().default(0),
  stage: z.string().nullable(),
  ownerId: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateContactSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

const ContactListQuerySchema = PaginationQuerySchema.extend({
  segment: z.coerce.number().optional(),
  tag: z.string().optional(),
});

export const crmContract = c.router({
  contacts: {
    list: {
      method: 'GET',
      path: '/api/crm/contacts',
      query: ContactListQuerySchema,
      responses: { 200: PaginatedResponseSchema(ContactSchema) },
    },
    get: {
      method: 'GET',
      path: '/api/crm/contacts/:id',
      pathParams: IdParamSchema,
      responses: { 200: ContactSchema, 404: ErrorSchema },
    },
    create: {
      method: 'POST',
      path: '/api/crm/contacts',
      body: CreateContactSchema,
      responses: { 201: ContactSchema, 400: ErrorSchema },
    },
    update: {
      method: 'PATCH',
      path: '/api/crm/contacts/:id',
      pathParams: IdParamSchema,
      body: UpdateContactSchema,
      responses: { 200: ContactSchema, 404: ErrorSchema },
    },
    delete: {
      method: 'DELETE',
      path: '/api/crm/contacts/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: { 204: z.void(), 404: ErrorSchema },
    },
  },
});
```

**Step 6: Create root index**

File: `packages/contracts/src/index.ts`

```typescript
export { identityContract, UserSchema } from './identity.contract';
export { crmContract, ContactSchema, CreateContactSchema, UpdateContactSchema } from './crm.contract';
export { PaginationQuerySchema, PaginatedResponseSchema, ErrorSchema, IdParamSchema } from './common';
```

**Step 7: Install deps, build, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/contracts build
git add packages/contracts/
git commit -m "feat: add contracts package with identity and CRM ts-rest contracts"
```

---

### Task 4: Create worker-lib Package

**Files:**
- Create: `packages/worker-lib/package.json`
- Create: `packages/worker-lib/tsconfig.json`
- Create: `packages/worker-lib/src/index.ts`
- Create: `packages/worker-lib/src/middleware/cors.ts`
- Create: `packages/worker-lib/src/middleware/error-handler.ts`
- Create: `packages/worker-lib/src/middleware/request-tracing.ts`
- Create: `packages/worker-lib/src/middleware/index.ts`
- Create: `packages/worker-lib/src/queue/event-publisher.ts`
- Create: `packages/worker-lib/src/queue/index.ts`
- Create: `packages/worker-lib/src/hyperdrive/drizzle-client.ts`
- Create: `packages/worker-lib/src/hyperdrive/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/worker-lib",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./middleware": { "import": "./dist/middleware/index.js", "types": "./dist/middleware/index.d.ts" },
    "./queue": { "import": "./dist/queue/index.js", "types": "./dist/queue/index.d.ts" },
    "./hyperdrive": { "import": "./dist/hyperdrive/index.js", "types": "./dist/hyperdrive/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@cloudflare/workers-types": "^4.20250109.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create CORS middleware**

File: `packages/worker-lib/src/middleware/cors.ts`

```typescript
import { createMiddleware } from 'hono/factory';

export const corsMiddleware = (allowedOrigins: string[]) =>
  createMiddleware(async (c, next) => {
    const origin = c.req.header('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (c.req.method === 'OPTIONS') {
      return c.text('', 204);
    }
    await next();
  });
```

**Step 4: Create error handler middleware**

File: `packages/worker-lib/src/middleware/error-handler.ts`

```typescript
import type { Context } from 'hono';

export const errorHandler = (err: Error, c: Context) => {
  console.error(`[${c.get('requestId') ?? 'unknown'}] Unhandled error:`, err.message, err.stack);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
};
```

**Step 5: Create request tracing middleware**

File: `packages/worker-lib/src/middleware/request-tracing.ts`

```typescript
import { createMiddleware } from 'hono/factory';

export const requestTracingMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${requestId}] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
});
```

**Step 6: Create event publisher**

File: `packages/worker-lib/src/queue/event-publisher.ts`

```typescript
import type { DomainEvent, DomainEventMetadata } from '@mauntic/domain-kernel/events';

export class EventPublisher {
  constructor(
    private queue: Queue,
    private sourceContext: string,
  ) {}

  async publish<T extends DomainEvent>(
    type: T['type'],
    data: T['data'],
    correlationId: string,
    causationId?: string,
  ): Promise<void> {
    const event: DomainEvent = {
      type,
      data,
      metadata: {
        sourceContext: this.sourceContext,
        timestamp: new Date().toISOString(),
        correlationId,
        causationId,
      },
    };
    await this.queue.send(event);
  }
}
```

**Step 7: Create Drizzle client helper**

File: `packages/worker-lib/src/hyperdrive/drizzle-client.ts`

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function createDrizzleClient(connectionString: string, schema?: Record<string, unknown>) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema: schema as any });
}
```

**Step 8: Create index files**

File: `packages/worker-lib/src/middleware/index.ts`
```typescript
export { corsMiddleware } from './cors';
export { errorHandler } from './error-handler';
export { requestTracingMiddleware } from './request-tracing';
```

File: `packages/worker-lib/src/queue/index.ts`
```typescript
export { EventPublisher } from './event-publisher';
```

File: `packages/worker-lib/src/hyperdrive/index.ts`
```typescript
export { createDrizzleClient } from './drizzle-client';
```

File: `packages/worker-lib/src/index.ts`
```typescript
export * from './middleware';
export * from './queue';
export * from './hyperdrive';
```

**Step 9: Install deps, build, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/worker-lib build
git add packages/worker-lib/
git commit -m "feat: add worker-lib package with shared middleware, queue, and DB utilities"
```

---

### Task 5: Create ui-kit Package

**Files:**
- Create: `packages/ui-kit/package.json`
- Create: `packages/ui-kit/tsconfig.json`
- Create: `packages/ui-kit/src/index.ts`
- Create: `packages/ui-kit/src/layouts/base-layout.tsx`
- Create: `packages/ui-kit/src/layouts/app-layout.tsx`
- Create: `packages/ui-kit/src/components/data-table.tsx`
- Create: `packages/ui-kit/src/components/pagination.tsx`
- Create: `packages/ui-kit/src/components/index.ts`
- Create: `packages/ui-kit/src/layouts/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/ui-kit",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./layouts": { "import": "./dist/layouts/index.js", "types": "./dist/layouts/index.d.ts" },
    "./components": { "import": "./dist/components/index.js", "types": "./dist/components/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create BaseLayout**

File: `packages/ui-kit/src/layouts/base-layout.tsx`

```tsx
import type { FC, PropsWithChildren } from 'hono/jsx';

interface BaseLayoutProps {
  title: string;
}

export const BaseLayout: FC<PropsWithChildren<BaseLayoutProps>> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - Mauntic</title>
      <script src="https://unpkg.com/htmx.org@2.0.4" />
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body class="bg-gray-50 text-gray-900">
      {children}
    </body>
  </html>
);
```

**Step 4: Create AppLayout with sidebar**

File: `packages/ui-kit/src/layouts/app-layout.tsx`

```tsx
import type { FC, PropsWithChildren } from 'hono/jsx';
import { BaseLayout } from './base-layout';

interface AppLayoutProps {
  title: string;
  activePage?: string;
}

const navItems = [
  { href: '/app/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/app/contacts', label: 'Contacts', icon: 'users' },
  { href: '/app/companies', label: 'Companies', icon: 'building' },
  { href: '/app/segments', label: 'Segments', icon: 'filter' },
  { href: '/app/campaigns', label: 'Campaigns', icon: 'zap' },
  { href: '/app/emails', label: 'Emails', icon: 'mail' },
  { href: '/app/forms', label: 'Forms', icon: 'clipboard' },
  { href: '/app/pages', label: 'Pages', icon: 'file-text' },
  { href: '/app/reports', label: 'Reports', icon: 'bar-chart' },
];

export const AppLayout: FC<PropsWithChildren<AppLayoutProps>> = ({ title, activePage, children }) => (
  <BaseLayout title={title}>
    <div class="flex h-screen">
      <nav class="w-64 bg-gray-900 text-white p-4 flex-shrink-0">
        <div class="text-xl font-bold mb-8 px-2">Mauntic</div>
        <ul class="space-y-1">
          {navItems.map((item) => (
            <li>
              <a
                href={item.href}
                hx-get={`/ui${item.href.replace('/app', '')}`}
                hx-target="#content"
                hx-push-url={item.href}
                class={`block px-3 py-2 rounded-md text-sm ${
                  activePage === item.label.toLowerCase()
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main class="flex-1 overflow-auto">
        <div class="p-8" id="content">
          {children}
        </div>
      </main>
    </div>
  </BaseLayout>
);
```

**Step 5: Create DataTable component**

File: `packages/ui-kit/src/components/data-table.tsx`

```tsx
import type { FC } from 'hono/jsx';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => string | number | null;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  items: T[];
  baseUrl: string;
}

export const DataTable: FC<DataTableProps<any>> = ({ columns, items, baseUrl }) => (
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          {columns.map((col) => (
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {items.map((item: any) => (
          <tr class="hover:bg-gray-50 cursor-pointer"
              hx-get={`${baseUrl}/${item.id}`}
              hx-target="#content"
              hx-push-url="true">
            {columns.map((col) => (
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {col.render ? col.render(item) : item[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

**Step 6: Create index files, build, commit**

File: `packages/ui-kit/src/components/pagination.tsx`
```tsx
import type { FC } from 'hono/jsx';

interface PaginationProps {
  page: number;
  totalPages: number;
  baseUrl: string;
}

export const Pagination: FC<PaginationProps> = ({ page, totalPages, baseUrl }) => (
  <div class="flex items-center justify-between py-4">
    <span class="text-sm text-gray-700">Page {page} of {totalPages}</span>
    <div class="flex space-x-2">
      {page > 1 && (
        <button hx-get={`${baseUrl}?page=${page - 1}`} hx-target="#content" class="px-3 py-1 border rounded text-sm hover:bg-gray-100">
          Previous
        </button>
      )}
      {page < totalPages && (
        <button hx-get={`${baseUrl}?page=${page + 1}`} hx-target="#content" class="px-3 py-1 border rounded text-sm hover:bg-gray-100">
          Next
        </button>
      )}
    </div>
  </div>
);
```

File: `packages/ui-kit/src/components/index.ts`
```typescript
export { DataTable } from './data-table';
export { Pagination } from './pagination';
```

File: `packages/ui-kit/src/layouts/index.ts`
```typescript
export { BaseLayout } from './base-layout';
export { AppLayout } from './app-layout';
```

File: `packages/ui-kit/src/index.ts`
```typescript
export * from './layouts';
export * from './components';
```

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/ui-kit build
git add packages/ui-kit/
git commit -m "feat: add ui-kit package with layouts and HTMX components"
```

---

### Task 6: Create Gateway Worker

**Files:**
- Create: `workers/gateway/package.json`
- Create: `workers/gateway/tsconfig.json`
- Create: `workers/gateway/wrangler.toml`
- Create: `workers/gateway/src/app.ts`
- Create: `workers/gateway/src/index.ts`
- Create: `workers/gateway/src/pages/dashboard.tsx`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/gateway",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir=dist",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@mauntic/worker-lib": "workspace:*",
    "@mauntic/ui-kit": "workspace:*",
    "@mauntic/contracts": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@cloudflare/workers-types": "^4.20250109.0",
    "wrangler": "^3.100.0"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "mauntic-gateway"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# Service Bindings to domain Workers
# Uncomment as Workers are deployed:
# [[services]]
# binding = "IDENTITY_WORKER"
# service = "mauntic-identity"
#
# [[services]]
# binding = "CRM_WORKER"
# service = "mauntic-crm"
#
# [[services]]
# binding = "CAMPAIGN_WORKER"
# service = "mauntic-campaign"
#
# [[services]]
# binding = "MESSAGING_WORKER"
# service = "mauntic-messaging"
#
# [[services]]
# binding = "CONTENT_WORKER"
# service = "mauntic-content"
#
# [[services]]
# binding = "ANALYTICS_WORKER"
# service = "mauntic-analytics"
#
# [[services]]
# binding = "INTEGRATIONS_WORKER"
# service = "mauntic-integrations"
```

**Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create app.ts**

File: `workers/gateway/src/app.ts`

```typescript
import { Hono } from 'hono';
import { requestTracingMiddleware, errorHandler } from '@mauntic/worker-lib/middleware';
import { AppLayout } from '@mauntic/ui-kit/layouts';
import { dashboardPage } from './pages/dashboard';

type Bindings = {
  // IDENTITY_WORKER: Fetcher;
  // CRM_WORKER: Fetcher;
  // CAMPAIGN_WORKER: Fetcher;
  // MESSAGING_WORKER: Fetcher;
  // CONTENT_WORKER: Fetcher;
  // ANALYTICS_WORKER: Fetcher;
  // INTEGRATIONS_WORKER: Fetcher;
};

type Variables = {
  requestId: string;
};

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.onError(errorHandler);
app.use('*', requestTracingMiddleware);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// App pages (HTMX full page loads)
app.get('/app', (c) => c.redirect('/app/dashboard'));
app.get('/app/dashboard', dashboardPage);

// TODO: Add Service Binding proxies as domain Workers are deployed
// app.all('/api/crm/*', async (c) => c.env.CRM_WORKER.fetch(c.req.raw));
// app.all('/ui/crm/*', async (c) => c.env.CRM_WORKER.fetch(c.req.raw));
```

**Step 5: Create dashboard page**

File: `workers/gateway/src/pages/dashboard.tsx`

```typescript
import type { Context } from 'hono';
import { AppLayout } from '@mauntic/ui-kit/layouts';

export const dashboardPage = (c: Context) => {
  return c.html(
    <AppLayout title="Dashboard" activePage="dashboard">
      <h1 class="text-2xl font-bold mb-6">Dashboard</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Total Contacts</div>
          <div class="text-3xl font-bold mt-2" hx-get="/ui/analytics/widgets/contact-count" hx-trigger="load">--</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Active Campaigns</div>
          <div class="text-3xl font-bold mt-2">--</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Emails Sent (30d)</div>
          <div class="text-3xl font-bold mt-2">--</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Form Submissions (30d)</div>
          <div class="text-3xl font-bold mt-2">--</div>
        </div>
      </div>
    </AppLayout>
  );
};
```

**Step 6: Create index.ts (Worker entry)**

File: `workers/gateway/src/index.ts`

```typescript
import { app } from './app';

export default app;
```

**Step 7: Install deps, typecheck, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/gateway typecheck
git add workers/gateway/
git commit -m "feat: add Gateway Worker with HTMX dashboard shell"
```

---

### Task 7: Create Identity Worker (Port auth from KMT)

**Reference:** `/Users/lsendel/Projects/knowledge-management-tool/server/infrastructure/better-auth.ts`

**Files:**
- Create: `workers/identity/package.json`
- Create: `workers/identity/tsconfig.json`
- Create: `workers/identity/wrangler.toml`
- Create: `workers/identity/src/app.ts`
- Create: `workers/identity/src/index.ts`
- Create: `workers/identity/src/infrastructure/better-auth.ts`
- Create: `workers/identity/src/infrastructure/auth-middleware.ts`
- Create: `workers/identity/src/interface/api/auth.handlers.ts`
- Create: `workers/identity/drizzle/schema.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/identity",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir=dist",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "better-auth": "^1.4.18",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "@mauntic/worker-lib": "workspace:*",
    "@mauntic/contracts": "workspace:*",
    "@mauntic/domain-kernel": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@cloudflare/workers-types": "^4.20250109.0",
    "wrangler": "^3.100.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "mauntic-identity"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
BETTER_AUTH_URL = "http://localhost:8787"

# [[hyperdrive]]
# binding = "HYPERDRIVE"
# id = "<your-hyperdrive-id>"
```

**Step 3: Create Drizzle schema**

File: `workers/identity/drizzle/schema.ts`

Port from KMT's `/Users/lsendel/Projects/knowledge-management-tool/drizzle/schema.ts` — the users, sessions, accounts, verification, organizations, and org_members tables. Update table names to use the `identity` Postgres schema.

```typescript
import { pgSchema, serial, text, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const identitySchema = pgSchema('identity');

export const userRoleEnum = identitySchema.enum('user_role', ['user', 'admin', 'superadmin']);

export const users = identitySchema.table('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('user'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = identitySchema.table('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = identitySchema.table('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = identitySchema.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Step 4: Create Better Auth config**

File: `workers/identity/src/infrastructure/better-auth.ts`

Port from KMT's `server/infrastructure/better-auth.ts`. Create per-request instance for Workers' stateless environment.

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../../drizzle/schema';

interface AuthConfig {
  db: NeonHttpDatabase<typeof schema>;
  secret: string;
  baseURL: string;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
}

export function createAuth(config: AuthConfig) {
  const socialProviders: any[] = [];

  if (config.googleClientId && config.googleClientSecret) {
    socialProviders.push({
      id: 'google',
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    });
  }

  if (config.githubClientId && config.githubClientSecret) {
    socialProviders.push({
      id: 'github',
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
    });
  }

  return betterAuth({
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verification,
      },
    }),
    secret: config.secret,
    baseURL: config.baseURL,
    socialProviders,
    emailAndPassword: {
      enabled: true,
    },
  });
}
```

**Step 5: Create auth middleware**

File: `workers/identity/src/infrastructure/auth-middleware.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import { createAuth } from './better-auth';
import { createDrizzleClient } from '@mauntic/worker-lib/hyperdrive';
import * as schema from '../../drizzle/schema';

export const authMiddleware = createMiddleware(async (c, next) => {
  const db = createDrizzleClient(c.env.DATABASE_URL, schema);
  const auth = createAuth({
    db: db as any,
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: c.env.BETTER_AUTH_URL,
    googleClientId: c.env.GOOGLE_CLIENT_ID,
    googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
    githubClientId: c.env.GITHUB_CLIENT_ID,
    githubClientSecret: c.env.GITHUB_CLIENT_SECRET,
  });

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', session?.user ?? null);
  c.set('session', session?.session ?? null);
  c.set('db', db);
  c.set('auth', auth);

  await next();
});
```

**Step 6: Create auth handlers**

File: `workers/identity/src/interface/api/auth.handlers.ts`

```typescript
import { Hono } from 'hono';

const authRoutes = new Hono();

// Proxy all /api/auth/* to Better Auth handler
authRoutes.all('/*', async (c) => {
  const auth = c.get('auth');
  return auth.handler(c.req.raw);
});

// Custom: Get current user
authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  return c.json(user);
});

export { authRoutes };
```

**Step 7: Create app.ts and index.ts**

File: `workers/identity/src/app.ts`

```typescript
import { Hono } from 'hono';
import { requestTracingMiddleware, errorHandler } from '@mauntic/worker-lib/middleware';
import { authMiddleware } from './infrastructure/auth-middleware';
import { authRoutes } from './interface/api/auth.handlers';

const app = new Hono();

app.onError(errorHandler);
app.use('*', requestTracingMiddleware);
app.use('*', authMiddleware);

app.route('/api/auth', authRoutes);

app.get('/health', (c) => c.json({ status: 'ok', context: 'identity' }));

export { app };
```

File: `workers/identity/src/index.ts`

```typescript
import { app } from './app';
export default app;
```

**Step 8: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*", "drizzle/**/*"]
}
```

**Step 9: Install deps, typecheck, commit**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/identity typecheck
git add workers/identity/
git commit -m "feat: add Identity Worker with Better Auth, Drizzle schema, auth middleware"
```

---

### Task 8: Create CRM Worker Skeleton

**Files:**
- Create: `workers/crm/package.json`
- Create: `workers/crm/tsconfig.json`
- Create: `workers/crm/wrangler.toml`
- Create: `workers/crm/src/app.ts`
- Create: `workers/crm/src/index.ts`
- Create: `workers/crm/src/domain/entities/contact.ts`
- Create: `workers/crm/src/domain/repositories/contact.repository.ts`
- Create: `workers/crm/src/application/commands/create-contact.command.ts`
- Create: `workers/crm/src/application/queries/list-contacts.query.ts`
- Create: `workers/crm/src/infrastructure/repositories/drizzle-contact.repository.ts`
- Create: `workers/crm/src/interface/api/contacts.handlers.ts`
- Create: `workers/crm/drizzle/schema.ts`

This follows the DDD structure exactly. See design doc Section 4 for the layer rules.

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/crm",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir=dist",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "@mauntic/worker-lib": "workspace:*",
    "@mauntic/contracts": "workspace:*",
    "@mauntic/domain-kernel": "workspace:*",
    "@mauntic/ui-kit": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@cloudflare/workers-types": "^4.20250109.0",
    "wrangler": "^3.100.0",
    "drizzle-kit": "^0.30.0"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "mauntic-crm"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# [[hyperdrive]]
# binding = "HYPERDRIVE"
# id = "<your-hyperdrive-id>"

# [[queues.producers]]
# binding = "CRM_EVENTS"
# queue = "mauntic-crm-events"
```

**Step 3: Create Drizzle schema**

File: `workers/crm/drizzle/schema.ts`

```typescript
import { pgSchema, serial, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const crmSchema = pgSchema('crm');

export const contacts = crmSchema.table('contacts', {
  id: serial('id').primaryKey(),
  firstname: varchar('firstname', { length: 255 }),
  lastname: varchar('lastname', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  position: varchar('position', { length: 255 }),
  points: integer('points').notNull().default(0),
  stage: varchar('stage', { length: 100 }),
  ownerId: integer('owner_id'),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const companies = crmSchema.table('companies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 255 }),
  city: varchar('city', { length: 255 }),
  country: varchar('country', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tags = crmSchema.table('tags', {
  id: serial('id').primaryKey(),
  tag: varchar('tag', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contactTags = crmSchema.table('contact_tags', {
  contactId: integer('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

export const segments = crmSchema.table('segments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isPublished: boolean('is_published').notNull().default(true),
  filters: text('filters'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Step 4: Create Contact domain entity**

File: `workers/crm/src/domain/entities/contact.ts`

```typescript
import type { ContactId } from '@mauntic/domain-kernel/value-objects';

export interface Contact {
  id: ContactId;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  points: number;
  stage: string | null;
  ownerId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
}

export interface UpdateContactInput {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
}
```

**Step 5: Create repository interface (port)**

File: `workers/crm/src/domain/repositories/contact.repository.ts`

```typescript
import type { Contact, CreateContactInput, UpdateContactInput } from '../entities/contact';

export interface ContactRepository {
  findById(id: number): Promise<Contact | null>;
  list(params: { page: number; limit: number; search?: string }): Promise<{ items: Contact[]; total: number }>;
  create(input: CreateContactInput): Promise<Contact>;
  update(id: number, input: UpdateContactInput): Promise<Contact | null>;
  delete(id: number): Promise<boolean>;
}
```

**Step 6: Create Drizzle repository implementation**

File: `workers/crm/src/infrastructure/repositories/drizzle-contact.repository.ts`

```typescript
import { eq, ilike, or, sql, count } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { contacts } from '../../../drizzle/schema';
import type { ContactRepository } from '../../domain/repositories/contact.repository';
import type { Contact, CreateContactInput, UpdateContactInput } from '../../domain/entities/contact';

export class DrizzleContactRepository implements ContactRepository {
  constructor(private db: NeonHttpDatabase) {}

  async findById(id: number): Promise<Contact | null> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    return (result[0] as Contact) ?? null;
  }

  async list(params: { page: number; limit: number; search?: string }): Promise<{ items: Contact[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    let query = this.db.select().from(contacts);

    if (params.search) {
      query = query.where(
        or(
          ilike(contacts.firstname, `%${params.search}%`),
          ilike(contacts.lastname, `%${params.search}%`),
          ilike(contacts.email, `%${params.search}%`),
        )
      ) as typeof query;
    }

    const [items, totalResult] = await Promise.all([
      query.limit(params.limit).offset(offset),
      this.db.select({ count: count() }).from(contacts),
    ]);

    return { items: items as Contact[], total: totalResult[0].count };
  }

  async create(input: CreateContactInput): Promise<Contact> {
    const result = await this.db.insert(contacts).values(input).returning();
    return result[0] as Contact;
  }

  async update(id: number, input: UpdateContactInput): Promise<Contact | null> {
    const result = await this.db
      .update(contacts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return (result[0] as Contact) ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(contacts).where(eq(contacts.id, id)).returning();
    return result.length > 0;
  }
}
```

**Step 7: Create application commands and queries**

File: `workers/crm/src/application/commands/create-contact.command.ts`

```typescript
import type { ContactRepository } from '../../domain/repositories/contact.repository';
import type { CreateContactInput, Contact } from '../../domain/entities/contact';

export class CreateContactCommand {
  constructor(private contactRepo: ContactRepository) {}

  async execute(input: CreateContactInput): Promise<Contact> {
    return this.contactRepo.create(input);
  }
}
```

File: `workers/crm/src/application/queries/list-contacts.query.ts`

```typescript
import type { ContactRepository } from '../../domain/repositories/contact.repository';
import type { Contact } from '../../domain/entities/contact';

interface ListContactsParams {
  page: number;
  limit: number;
  search?: string;
}

interface ListContactsResult {
  items: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListContactsQuery {
  constructor(private contactRepo: ContactRepository) {}

  async execute(params: ListContactsParams): Promise<ListContactsResult> {
    const { items, total } = await this.contactRepo.list(params);
    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }
}
```

**Step 8: Create API handlers**

File: `workers/crm/src/interface/api/contacts.handlers.ts`

```typescript
import { Hono } from 'hono';
import { DrizzleContactRepository } from '../../infrastructure/repositories/drizzle-contact.repository';
import { CreateContactCommand } from '../../application/commands/create-contact.command';
import { ListContactsQuery } from '../../application/queries/list-contacts.query';

const contactRoutes = new Hono();

contactRoutes.get('/', async (c) => {
  const db = c.get('db');
  const repo = new DrizzleContactRepository(db);
  const query = new ListContactsQuery(repo);
  const page = Number(c.req.query('page') ?? 1);
  const limit = Number(c.req.query('limit') ?? 20);
  const search = c.req.query('search');
  const result = await query.execute({ page, limit, search });
  return c.json(result);
});

contactRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const repo = new DrizzleContactRepository(db);
  const contact = await repo.findById(Number(c.req.param('id')));
  if (!contact) return c.json({ error: 'Contact not found' }, 404);
  return c.json(contact);
});

contactRoutes.post('/', async (c) => {
  const db = c.get('db');
  const repo = new DrizzleContactRepository(db);
  const cmd = new CreateContactCommand(repo);
  const body = await c.req.json();
  const contact = await cmd.execute(body);
  return c.json(contact, 201);
});

contactRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const repo = new DrizzleContactRepository(db);
  const body = await c.req.json();
  const contact = await repo.update(Number(c.req.param('id')), body);
  if (!contact) return c.json({ error: 'Contact not found' }, 404);
  return c.json(contact);
});

contactRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const repo = new DrizzleContactRepository(db);
  const deleted = await repo.delete(Number(c.req.param('id')));
  if (!deleted) return c.json({ error: 'Contact not found' }, 404);
  return c.body(null, 204);
});

export { contactRoutes };
```

**Step 9: Create app.ts and index.ts**

File: `workers/crm/src/app.ts`

```typescript
import { Hono } from 'hono';
import { requestTracingMiddleware, errorHandler } from '@mauntic/worker-lib/middleware';
import { createMiddleware } from 'hono/factory';
import { createDrizzleClient } from '@mauntic/worker-lib/hyperdrive';
import { contactRoutes } from './interface/api/contacts.handlers';
import * as schema from '../drizzle/schema';

const app = new Hono();

app.onError(errorHandler);
app.use('*', requestTracingMiddleware);

// DB middleware
app.use('*', createMiddleware(async (c, next) => {
  const db = createDrizzleClient(c.env.DATABASE_URL, schema);
  c.set('db', db);
  await next();
}));

// API routes (JSON)
app.route('/api/crm/contacts', contactRoutes);

// UI routes (HTMX partials) — TODO in Phase 3
// app.route('/ui/contacts', contactPages);

app.get('/health', (c) => c.json({ status: 'ok', context: 'crm' }));

export { app };
```

File: `workers/crm/src/index.ts`

```typescript
import { app } from './app';
export default app;
```

**Step 10: Create tsconfig.json, install deps, commit**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*", "drizzle/**/*"]
}
```

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install && pnpm --filter @mauntic/crm typecheck
git add workers/crm/
git commit -m "feat: add CRM Worker with DDD contact management (domain, application, infrastructure, interface layers)"
```

---

### Task 9-12: Create Remaining Worker Skeletons

Follow the same pattern as Task 8 for each remaining Worker. Each gets:
- `package.json`, `tsconfig.json`, `wrangler.toml`
- DDD directory structure: `domain/`, `application/`, `infrastructure/`, `interface/`
- Drizzle schema in `drizzle/schema.ts`
- Health check endpoint
- `app.ts` and `index.ts`

**Task 9:** Campaign Worker (`workers/campaign/`) — `campaign` schema with campaigns, events, actions, decisions, event_log, points tables

**Task 10:** Messaging Worker (`workers/messaging/`) — `messaging` schema with emails, email_stats, send_jobs, sms, notifications tables

**Task 11:** Content Worker (`workers/content/`) — `content` schema with forms, form_fields, form_submissions, pages, assets tables

**Task 12:** Analytics + Integrations Workers (`workers/analytics/`, `workers/integrations/`) — `analytics` schema with reports, widgets; `integrations` schema with webhooks, sync_jobs tables

Each commit: `feat: add <Context> Worker skeleton with DDD structure and Drizzle schema`

---

## Phase 1: Define All Contracts (Tasks 13-19)

Map every Mautic API endpoint to ts-rest contracts. Reference the original Mautic API at `/Users/lsendel/Projects/mauntic/app/bundles/*/Controller/Api/*Controller.php`.

### Task 13: Complete CRM Contracts
- Add segments, companies, fields, tags, stages, categories endpoints
- Add filter/sort schemas for each

### Task 14: Campaign Contracts
- Campaigns CRUD, campaign events, actions, decisions
- Campaign execution triggers, point triggers

### Task 15: Messaging Contracts
- Email CRUD, email send, email stats
- SMS CRUD, notification CRUD
- Tracking endpoints (opens, clicks, bounces)

### Task 16: Content Contracts
- Forms CRUD, form submissions, form fields
- Pages CRUD, page hits
- Assets CRUD, asset downloads
- Dynamic content CRUD

### Task 17: Analytics Contracts
- Reports CRUD, report execution, report scheduling
- Dashboard widgets CRUD, widget data

### Task 18: Integrations Contracts
- Integrations CRUD, integration config
- Webhooks CRUD, webhook logs
- Sync jobs CRUD, sync mappings

### Task 19: Identity Contracts (expand)
- Users CRUD, roles, permissions
- Organizations CRUD, org members
- Expand beyond basic auth/me

---

## Phase 2: Identity Context (Tasks 20-24)

### Task 20: Complete Identity schema and migrations
### Task 21: Implement user CRUD with DDD layers
### Task 22: Implement organization management
### Task 23: Implement role-based permissions
### Task 24: Wire Gateway <-> Identity Service Binding

---

## Phase 3: CRM Context (Tasks 25-35)

### Task 25: Complete Contact aggregate (domain layer)
### Task 26: Implement Contact CRUD (all layers)
### Task 27: Implement Company aggregate
### Task 28: Implement Segment aggregate with filter engine
### Task 29: Implement custom Fields system
### Task 30: Implement Tags
### Task 31: Implement DoNotContact and FrequencyRules
### Task 32: Implement Stages and Categories
### Task 33: Wire CRM event publishing to Queues
### Task 34: Build HTMX UI for contacts (list, detail, create, edit)
### Task 35: Wire Gateway <-> CRM Service Binding

---

## Phase 4: Campaign Context (Tasks 36-42)

### Task 36: Campaign aggregate (domain layer)
### Task 37: Campaign builder flow (events, actions, decisions)
### Task 38: Campaign execution engine (Queue consumers)
### Task 39: Point system
### Task 40: Campaign event handlers for CRM events
### Task 41: Build HTMX campaign builder UI
### Task 42: Wire Gateway <-> Campaign Service Binding

---

## Phase 5: Messaging Context (Tasks 43-50)

### Task 43: Email template aggregate
### Task 44: Bulk email send engine (Queue batching)
### Task 45: Email tracking (opens, clicks, bounces)
### Task 46: R2 integration for email assets
### Task 47: SMS messaging
### Task 48: Push notifications
### Task 49: Build HTMX email editor UI
### Task 50: Wire Gateway <-> Messaging Service Binding

---

## Phase 6: Content Context (Tasks 51-57)

### Task 51: Form builder aggregate
### Task 52: Form submission processing
### Task 53: Landing page builder
### Task 54: Asset management with R2
### Task 55: Dynamic content engine
### Task 56: Build HTMX form/page builder UI
### Task 57: Wire Gateway <-> Content Service Binding

---

## Phase 7: Analytics & Integrations (Tasks 58-65)

### Task 58: Report engine aggregate
### Task 59: Dashboard widgets with data aggregation
### Task 60: Queue consumer for all domain events (analytics materialization)
### Task 61: Webhook dispatch engine
### Task 62: Third-party CRM sync
### Task 63: Integration configuration UI
### Task 64: Wire Gateway <-> Analytics + Integrations Service Bindings
### Task 65: Build HTMX reporting UI

---

## Phase 8: Polish & Migration (Tasks 66-70)

### Task 66: Data migration scripts (MySQL -> Neon Postgres)
### Task 67: End-to-end testing
### Task 68: Performance optimization (caching, query tuning)
### Task 69: CI/CD pipeline finalization
### Task 70: Documentation and deployment guide
