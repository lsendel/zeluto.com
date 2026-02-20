# CI/CD + Gateway Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Commit registration bug fixes, modularize the 1448-line gateway app.tsx into route modules using `@mauntic/contracts` Zod schemas for type-safe dispatch requests, scope middleware for performance, add 80% test coverage, and migrate deploys to Cloudflare Workers Builds.

**Architecture:** The `@mauntic/contracts` package already defines every API route, request body, query schema, and response type using ts-rest + Zod — but the gateway doesn't use them. This plan wires the existing contracts into the gateway's route modules for type-safe request parsing, while keeping lightweight `forwardToService()` for pure-proxy routes. A second phase adds `@ts-rest/serverless` to downstream workers for full contract-driven implementations.

**Tech Stack:** Hono.js, `@ts-rest/core` + `@mauntic/contracts` (Zod schemas), Vitest, Playwright, pnpm + Turborepo, Cloudflare Workers Builds

**Key finding:** There is no `@ts-rest/hono` package. The official server-side package is `@ts-rest/serverless` with `/fetch` sub-import. At the gateway (proxy) level, using full ts-rest server-side adds double-parsing overhead. Instead, we import contract Zod schemas directly for type annotations and validation on dispatch routes only.

---

### Task 0: Commit Registration Bug Fixes

Registration bug fixes from the previous session are coded but uncommitted. These must land first since all other work builds on them.

**Files:**
- Modified: `workers/gateway/src/views/onboarding/signup.tsx` (HTMX swap fix)
- Modified: `workers/gateway/src/views/onboarding/create-org.tsx` (endpoint + redirect fix)
- Modified: `workers/gateway/src/routes/onboarding.tsx` (new dispatch endpoint + API routes)
- Modified: `workers/identity/src/app.ts` (new `/__dispatch/identity/onboarding/create-org`)
- Modified: `workers/identity/src/interface/dispatch-routes.ts`
- Modified: 18x `workers/*/wrangler.toml` (localConnectionString for Hyperdrive)

**Step 1: Review changes**

```bash
git diff --stat
git diff workers/gateway/src/views/onboarding/signup.tsx
git diff workers/gateway/src/views/onboarding/create-org.tsx
git diff workers/identity/src/app.ts
```

Verify: signup.tsx uses `hx-swap="none"` + `hx-on--after-request` redirect. create-org.tsx posts to `/api/v1/onboarding/create-org`. identity/app.ts has the new `/__dispatch/identity/onboarding/create-org` endpoint registered BEFORE `dispatchRoutes`.

**Step 2: Run typecheck**

```bash
pnpm turbo typecheck --filter=@mauntic/gateway --filter=@mauntic/identity
```

Expected: PASS (may have pre-existing `onclick` warnings in ui-kit — those are not blockers)

**Step 3: Commit**

```bash
git add workers/gateway/src/views/onboarding/signup.tsx \
       workers/gateway/src/views/onboarding/create-org.tsx \
       workers/gateway/src/routes/onboarding.tsx \
       workers/identity/src/app.ts \
       workers/identity/src/interface/dispatch-routes.ts
git commit -m "fix: registration flow — HTMX swap, create-org endpoint bypass tenant middleware"
```

**Step 4: Commit wrangler.toml changes separately**

```bash
git add workers/*/wrangler.toml
git commit -m "chore: add Hyperdrive localConnectionString to all wrangler.toml for local dev"
```

---

### Task 1: Create Shared Dispatch + Forward Helpers

Replace 3 duplicated dispatch functions (`identityDispatchRequest`, `deliveryDispatchRequest`, `analyticsDispatchRequest`) and the inline `forwardToService()` with shared utilities.

**Files:**
- Create: `workers/gateway/src/lib/dispatch.ts`
- Create: `workers/gateway/src/lib/forward.ts`
- Test: `workers/gateway/src/lib/dispatch.test.ts`
- Test: `workers/gateway/src/lib/forward.test.ts`
- Modify: `workers/gateway/package.json` (add vitest)
- Create: `workers/gateway/vitest.config.ts`

**Step 1: Add vitest to gateway**

In `workers/gateway/package.json`, add `"test": "vitest run"` to scripts and `"vitest": "^3.1.0"` to devDependencies.

Create `workers/gateway/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 2: Write failing test for dispatch helper**

Create `workers/gateway/src/lib/dispatch.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { dispatchRequest } from './dispatch.js';

function createMockContext(overrides: {
  tenantContext?: Record<string, unknown>;
  tenantContextCacheKey?: string;
  requestId?: string;
} = {}) {
  const store = new Map<string, unknown>();
  store.set('tenantContext', overrides.tenantContext ?? {
    organizationId: 'org-1', userId: 'user-1', userRole: 'admin', plan: 'pro',
  });
  if (overrides.tenantContextCacheKey) store.set('tenantContextCacheKey', overrides.tenantContextCacheKey);
  if (overrides.requestId) store.set('requestId', overrides.requestId);
  return { get: (key: string) => store.get(key) };
}

describe('dispatchRequest', () => {
  it('returns null when dispatch binding is undefined', async () => {
    const c = createMockContext();
    const result = await dispatchRequest(c as any, {
      dispatch: undefined, http: {} as any, serviceName: 'identity',
    }, 'users/list', { page: 1 });
    expect(result).toBeNull();
  });

  it('returns null when tenant is missing and skipTenant is false', async () => {
    const c = createMockContext({ tenantContext: undefined });
    const mockDispatch = { fetch: vi.fn() };
    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any, http: {} as any, serviceName: 'identity',
    }, 'users/list', { page: 1 });
    expect(result).toBeNull();
  });

  it('calls dispatch with correct URL, tenant header, and request ID', async () => {
    const c = createMockContext({ requestId: 'req-123' });
    const mockResponse = new Response('{"ok":true}', { status: 200 });
    const mockDispatch = { fetch: vi.fn().mockResolvedValue(mockResponse) };

    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any, http: {} as any, serviceName: 'identity',
    }, 'users/list', { page: 1 });

    expect(result).not.toBeNull();
    expect(mockDispatch.fetch).toHaveBeenCalledWith(
      'https://identity.internal/__dispatch/identity/users/list',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ page: 1 }) }),
    );
    const headers = mockDispatch.fetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Request-Id']).toBe('req-123');
    expect(headers['X-Tenant-Context']).toBeDefined();
  });

  it('skips tenant header when skipTenant is true', async () => {
    const c = createMockContext({ tenantContext: undefined });
    const mockDispatch = { fetch: vi.fn().mockResolvedValue(new Response('{}')) };

    await dispatchRequest(c as any, {
      dispatch: mockDispatch as any, http: {} as any, serviceName: 'identity',
    }, 'session/validate', {}, { skipTenant: true });

    const headers = mockDispatch.fetch.mock.calls[0][1].headers;
    expect(headers['X-Tenant-Context']).toBeUndefined();
  });

  it('returns null on fetch error (fallback path)', async () => {
    const c = createMockContext();
    const mockDispatch = { fetch: vi.fn().mockRejectedValue(new Error('net')) };
    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any, http: {} as any, serviceName: 'identity',
    }, 'users/list', {});
    expect(result).toBeNull();
  });
});
```

**Step 3: Run test, confirm failure**

```bash
cd workers/gateway && pnpm install && pnpm test -- src/lib/dispatch.test.ts
```

Expected: FAIL — `Cannot find module './dispatch.js'`

**Step 4: Implement dispatch.ts**

Create `workers/gateway/src/lib/dispatch.ts`:

```typescript
import type { Context } from 'hono';
import type { Env } from '../index.js';

export interface ServiceBinding {
  dispatch?: Fetcher;
  http: Fetcher;
  serviceName: string;
}

function encodeTenantHeader(tenant: unknown): string {
  return btoa(JSON.stringify(tenant));
}

/**
 * Dispatch request to downstream worker via Durable Object dispatch binding.
 * Returns null if unavailable or missing tenant (caller falls back to forwardToService).
 */
export async function dispatchRequest(
  c: Context<Env>,
  service: ServiceBinding,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: { skipTenant?: boolean },
): Promise<Response | null> {
  if (!service.dispatch) return null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!options?.skipTenant) {
    const tenant = c.get('tenantContext');
    if (!tenant) return null;
    headers['X-Tenant-Context'] = encodeTenantHeader(tenant);
    const cacheKey = c.get('tenantContextCacheKey');
    if (cacheKey) headers['X-Tenant-Context-Key'] = cacheKey;
  }

  const requestId = c.get('requestId');
  if (requestId) headers['X-Request-Id'] = requestId;

  try {
    const res = await service.dispatch.fetch(
      `https://${service.serviceName}.internal/__dispatch/${service.serviceName}/${endpoint}`,
      { method: 'POST', headers, body: JSON.stringify(payload) },
    );
    return new Response(res.body, res);
  } catch {
    return null;
  }
}
```

**Step 5: Run test, confirm pass**

```bash
cd workers/gateway && pnpm test -- src/lib/dispatch.test.ts
```

Expected: PASS (5 tests)

**Step 6: Write + implement forward.ts** (extract `forwardToService` from app.tsx line 1387)

Create `workers/gateway/src/lib/forward.ts` — copy the existing `forwardToService` function from `app.tsx:1387-1438` exactly, adding the import for `Context` and `Env`.

Create `workers/gateway/src/lib/forward.test.ts` with tests for: GET forwarding, tenant header propagation, skipTenant, 503 on service error.

**Step 7: Run all tests**

```bash
cd workers/gateway && pnpm test
```

Expected: PASS

**Step 8: Commit**

```bash
git add workers/gateway/src/lib/ workers/gateway/vitest.config.ts workers/gateway/package.json
git commit -m "feat(gateway): add generic dispatch + forward helpers with tests"
```

---

### Task 2: Extract Identity Routes Using Contract Schemas

This is the template for all route extractions. Import Zod schemas from `@mauntic/contracts` for type-safe request body parsing on dispatch routes.

**Files:**
- Create: `workers/gateway/src/routes/identity.ts`
- Modify: `workers/gateway/src/app.tsx` (remove 15 identity route handlers + `identityDispatchRequest` + `parseOrganizationPayload`)
- Modify: `workers/gateway/package.json` (add `@mauntic/contracts` dependency)

**Key insight — Contract path mismatch:**
- Contracts define paths like `/api/v1/users/:id` and `/api/v1/organizations/:id`
- Gateway routes to `/api/v1/identity/users/:userId` and `/api/v1/identity/organizations/:organizationId`
- The gateway adds an `identity/` prefix and uses different param names
- We import the **Zod body/query schemas** for type safety, not the contract paths

**Step 1: Add @mauntic/contracts to gateway dependencies**

In `workers/gateway/package.json`, add:
```json
"@mauntic/contracts": "workspace:*"
```

Run `pnpm install` to link.

**Step 2: Create identity route module**

Create `workers/gateway/src/routes/identity.ts`:

```typescript
import { Hono } from 'hono';
import type { Env } from '../index.js';
import { dispatchRequest, type ServiceBinding } from '../lib/dispatch.js';
import { forwardToService } from '../lib/forward.js';
import { PaginationQuerySchema } from '@mauntic/contracts';
import { z } from 'zod';

// Import body schemas from the identity contract for type-safe parsing.
// These are the same Zod schemas defined in packages/contracts/src/identity.contract.ts.
const UpdateUserBodySchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().nullable().optional(),
});

const UpdateUserRoleBodySchema = z.object({
  role: z.enum(['admin', 'user']),
});

const CreateOrganizationBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  logo: z.string().optional(),
});

const InviteMemberBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

export function createIdentityRoutes() {
  const app = new Hono<Env>();

  function binding(c: any): ServiceBinding {
    return { dispatch: c.env.IDENTITY_DISPATCH, http: c.env.IDENTITY, serviceName: 'identity' };
  }

  // --- Users ---

  app.get('/users', async (c) => {
    const query = PaginationQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return await dispatchRequest(c, binding(c), 'users/list', query)
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.get('/users/:userId', async (c) => {
    return await dispatchRequest(c, binding(c), 'users/get', { userId: c.req.param('userId') })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/users/:userId/profile', async (c) => {
    const body = UpdateUserBodySchema.parse(await c.req.json().catch(() => ({})));
    return await dispatchRequest(c, binding(c), 'users/update-profile', {
      userId: c.req.param('userId'), ...body,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/users/:userId/role', async (c) => {
    const body = UpdateUserRoleBodySchema.parse(await c.req.json().catch(() => ({})));
    return await dispatchRequest(c, binding(c), 'users/update-role', {
      userId: c.req.param('userId'), ...body,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/users/:userId/block', async (c) => {
    return await dispatchRequest(c, binding(c), 'users/block', { userId: c.req.param('userId') })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/users/:userId/unblock', async (c) => {
    return await dispatchRequest(c, binding(c), 'users/unblock', { userId: c.req.param('userId') })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Organizations ---

  app.get('/organizations', async (c) => {
    const query = PaginationQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return await dispatchRequest(c, binding(c), 'organizations/list', query)
      ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);
    const body = CreateOrganizationBodySchema.parse(await c.req.json().catch(() => ({})));
    return await dispatchRequest(c, binding(c), 'organizations/create', {
      ...body, creatorUserId: user.id,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.patch('/organizations/:organizationId', async (c) => {
    const body = CreateOrganizationBodySchema.partial().parse(await c.req.json().catch(() => ({})));
    return await dispatchRequest(c, binding(c), 'organizations/update', {
      organizationId: c.req.param('organizationId'), ...body,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId', async (c) => {
    return await dispatchRequest(c, binding(c), 'organizations/delete', {
      organizationId: c.req.param('organizationId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/switch', async (c) => {
    return await dispatchRequest(c, binding(c), 'organizations/switch', {
      organizationId: c.req.param('organizationId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Members ---

  app.get('/organizations/:organizationId/members', async (c) => {
    const query = PaginationQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return await dispatchRequest(c, binding(c), 'organizations/members', {
      organizationId: c.req.param('organizationId'), ...query,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId/members/:userId', async (c) => {
    return await dispatchRequest(c, binding(c), 'organizations/members/remove', {
      organizationId: c.req.param('organizationId'), userId: c.req.param('userId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  // --- Invites ---

  app.get('/organizations/:organizationId/invites', async (c) => {
    const query = PaginationQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return await dispatchRequest(c, binding(c), 'organizations/invites/list', {
      organizationId: c.req.param('organizationId'), ...query,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/invites', async (c) => {
    const body = InviteMemberBodySchema.parse(await c.req.json().catch(() => ({})));
    return await dispatchRequest(c, binding(c), 'organizations/invites/create', {
      organizationId: c.req.param('organizationId'), ...body,
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.delete('/organizations/:organizationId/invites/:inviteId', async (c) => {
    return await dispatchRequest(c, binding(c), 'organizations/invites/delete', {
      organizationId: c.req.param('organizationId'), inviteId: c.req.param('inviteId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/organizations/:organizationId/invites/:inviteId/resend', async (c) => {
    return await dispatchRequest(c, binding(c), 'organizations/invites/resend', {
      organizationId: c.req.param('organizationId'), inviteId: c.req.param('inviteId'),
    }) ?? forwardToService(c, c.env.IDENTITY);
  });

  app.post('/invites/:token/accept', async (c) => {
    return await dispatchRequest(c, binding(c), 'invites/accept', { token: c.req.param('token') })
      ?? forwardToService(c, c.env.IDENTITY);
  });

  return app;
}
```

**Step 3: Update app.tsx**

1. Add import: `import { createIdentityRoutes } from './routes/identity.js';`
2. Remove all identity route handlers (lines 168–460 in current app.tsx)
3. Remove `identityDispatchRequest` function (lines 1306–1349)
4. Remove `parseOrganizationPayload` function (lines 1351–1378)
5. Add route mount: `app.route('/api/v1/identity', createIdentityRoutes());`

**Step 4: Run typecheck + tests**

```bash
pnpm turbo typecheck --filter=@mauntic/gateway && cd workers/gateway && pnpm test
```

**Step 5: Commit**

```bash
git add workers/gateway/src/routes/identity.ts workers/gateway/src/app.tsx workers/gateway/package.json
git commit -m "refactor(gateway): extract identity routes with contract Zod schemas"
```

---

### Task 3: Extract Delivery Routes Using Contract Schemas

**Files:**
- Create: `workers/gateway/src/routes/delivery.ts`
- Modify: `workers/gateway/src/app.tsx`

Import delivery contract schemas for typed request parsing. The delivery module has complex routes (sending-domains, jobs, providers, suppressions, warmup) that all use dispatch with the `deliveryDispatchRequest` pattern.

Key: `parseDeliveryProviderPayload` has special handling for `config` (JSON.parse), `isActive` (boolean), `priority` (number) — use the `ProviderConfigSchema` from contracts instead.

Remove from app.tsx: all delivery routes (lines 484–696), `deliveryDispatchRequest` (lines 1140–1182), and all 4 `parseDelivery*Payload` functions (lines 1233–1304).

**Commit:** `refactor(gateway): extract delivery routes with contract Zod schemas`

---

### Task 4: Extract Analytics Routes Using Contract Schemas

**Files:**
- Create: `workers/gateway/src/routes/analytics.ts`
- Modify: `workers/gateway/src/app.tsx`

Import analytics contract schemas (`OverviewStatsSchema`, `ReportSchema`, etc.). Remove `analyticsDispatchRequest` (lines 1184–1226) and `readJsonBody` (lines 1228–1231).

**Commit:** `refactor(gateway): extract analytics routes with contract Zod schemas`

---

### Task 5: Extract Remaining Routes + Slim app.tsx

Create route modules for all remaining services. Most are simple `forwardToService()` catch-alls that don't need contract schemas at the gateway level.

**Files to create:**
- `workers/gateway/src/routes/billing.ts` — Stripe webhook (`skipTenant`) + catch-all
- `workers/gateway/src/routes/crm.ts` — CRM segment dispatch + catch-all. Move `forwardCrmSegmentQueryViaDispatch` here.
- `workers/gateway/src/routes/campaign.ts` — catch-all forward
- `workers/gateway/src/routes/journey.ts` — catch-all forward
- `workers/gateway/src/routes/content.ts` — catch-all forward
- `workers/gateway/src/routes/integrations.ts` — catch-all forward
- `workers/gateway/src/routes/lead-intelligence.ts` — catch-all forward (+ views)
- `workers/gateway/src/routes/scoring.ts` — catch-all forward (+ views)
- `workers/gateway/src/routes/revops.ts` — catch-all forward (+ views)
- `workers/gateway/src/routes/pages.tsx` — `/app/*` SSR shell, `/login`, `/` redirect

Each simple module follows this pattern:

```typescript
import { Hono } from 'hono';
import type { Env } from '../index.js';
import { forwardToService } from '../lib/forward.js';

export function createCampaignRoutes() {
  const app = new Hono<Env>();
  app.all('/*', (c) => forwardToService(c, c.env.CAMPAIGN));
  return app;
}
```

**Final app.tsx** should be ~100 lines: imports → middleware stack → health/assets → auth routes → `/api/v1/me` → service route mounts → onboarding → pages.

Remove from app.tsx: `forwardCrmSegmentQueryViaDispatch`, `fetchBillingSubscription`, `encodeTenantHeader`, `forwardToService` (moved to lib/), `getPageTitle`, all route handlers.

**Commit:** `refactor(gateway): extract all service routes, slim app.tsx to ~100 lines`

---

### Task 6: Scope Middleware for Performance

**Files:**
- Modify: `workers/gateway/src/app.tsx`

Change middleware application from `app.use('*')` to scoped paths:

```typescript
// Keep on * (cheap, needed everywhere):
app.use('*', corsMiddleware([...]));
app.use('*', loggingMiddleware('gateway'));

// Scope to paths that need auth:
app.use('/api/*', authMiddleware());
app.use('/app/*', authMiddleware());
app.use('/login', authMiddleware());
app.use('/', authMiddleware());

// Tenant only for tenant-required paths:
app.use('/api/v1/*', tenantMiddleware());
app.use('/app/*', tenantMiddleware());

// CSRF only for HTML form mutations:
app.use('/app/*', async (c, next) => csrfMiddleware(c.env.KV)(c, next));
```

This means `/health`, `/assets/*` skip auth/tenant/CSRF entirely at the Hono routing level.

**Commit:** `perf(gateway): scope auth/tenant/CSRF middleware to paths that need them`

---

### Task 7: Session Validation Caching

**Files:**
- Modify: `workers/gateway/src/middleware/auth.ts`
- Test: `workers/gateway/src/middleware/auth.test.ts`

Cache validated sessions in KV for 60s to avoid calling Identity Worker on every request.

Extract `extractSessionToken()` for testing. Before calling Identity Worker, check `KV.get('session:<token_prefix>')`. After successful validation, `KV.put()` with 60s TTL.

**Commit:** `perf(gateway): cache validated sessions in KV for 60s`

---

### Task 8: CI/CD — Slim GitHub Actions to Quality Gates

**Files:**
- Modify: `.github/workflows/ci.yml` — keep only lint, typecheck, test jobs
- Delete: `.github/workflows/cloudflare-workers.yml`

Rewrite `ci.yml` to a single `quality` job (checkout → pnpm → install → lint → typecheck → test). Remove `deploy-workers` and `deploy-services` jobs.

**Commit:** `ci: slim GitHub Actions to quality gates only, remove deploy jobs`

---

### Task 9: CI/CD — Workers Builds Setup Script

**Files:**
- Create: `scripts/setup-workers-builds.sh`

Script iterates `workers/*/wrangler.toml`, extracts worker name, outputs per-worker Cloudflare Deployments configuration (build command, watch paths, env vars). Key per-worker config:

```
Build command: npm i -g pnpm@10 && pnpm install --frozen-lockfile && pnpm turbo build --filter=./workers/<name>...
Environment: SKIP_DEPENDENCY_INSTALL=true
Watch paths: workers/<name>/, packages/worker-lib/, packages/db/
```

**Commit:** `ci: add Workers Builds setup script for 21-worker monorepo`

---

### Task 10: Playwright E2E Tests

**Files:**
- Create: `tests/e2e/playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/onboarding.spec.ts`
- Create: `tests/e2e/navigation.spec.ts`
- Modify: `package.json` (add `test:e2e` script + `@playwright/test` devDependency)

Tests cover:
- Login/signup page rendering
- Unauthenticated redirect behavior
- Onboarding flow (org creation, plan selection)
- All 13 app pages load or redirect correctly
- `/health` endpoint returns ok

**Commit:** `test: add Playwright E2E tests for auth, onboarding, and page navigation`

---

### Task 11: Wire ts-rest Server-Side in Downstream Workers (Phase 2)

This task brings `@ts-rest/serverless` into the downstream workers where business logic lives. This is where the contracts deliver the most value — typed handlers, automatic request validation, and response type checking.

**Files:**
- Modify: `pnpm-workspace.yaml` (add `@ts-rest/serverless` to catalog at `^3.52.1`)
- Modify: One pilot worker (e.g., `workers/crm/package.json`)
- Modify: `workers/crm/src/http.ts` (or equivalent entry)

**Step 1: Add @ts-rest/serverless to workspace catalog**

```yaml
# pnpm-workspace.yaml catalog section:
'@ts-rest/serverless': ^3.52.1
```

**Step 2: Pilot implementation in CRM worker**

```typescript
// workers/crm/src/http.ts
import { fetchRequestHandler, tsr } from '@ts-rest/serverless/fetch';
import { crmContract } from '@mauntic/contracts';

interface PlatformContext {
  env: Env;
  tenantContext: TenantContext;
  requestId: string;
}

const router = tsr
  .platformContext<PlatformContext>()
  .router(crmContract, {
    contacts: {
      list: async ({ query }, ctx) => {
        const db = createDatabase(ctx.env);
        const contacts = await listContacts(db, ctx.tenantContext.organizationId, query);
        return { status: 200 as const, body: contacts };
      },
      // ... other handlers
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Parse tenant context from X-Tenant-Context header
    const tenantContext = parseTenantHeader(request.headers);
    if (!tenantContext) {
      return Response.json({ code: 'MISSING_TENANT_CONTEXT', message: 'Required' }, { status: 400 });
    }

    return fetchRequestHandler({
      request,
      contract: crmContract,
      router,
      options: { basePath: '/api/v1/crm' },
      platformContext: { env, tenantContext, requestId: request.headers.get('X-Request-Id') ?? '' },
    });
  },
};
```

**Step 3: Test CRM worker with contracts**

```bash
pnpm turbo typecheck --filter=@mauntic/crm && cd workers/crm && pnpm test
```

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml workers/crm/
git commit -m "feat(crm): wire ts-rest/serverless for contract-driven route handlers"
```

After the CRM pilot succeeds, repeat for other workers with dispatch routes (identity, delivery, analytics). Workers that are pure catch-all forwards from the gateway can be migrated incrementally.

---

## Summary

| Task | Description | Contract Usage | Files |
|------|------------|---------------|-------|
| 0 | Commit registration fixes | — | 8 |
| 1 | Shared dispatch + forward helpers + tests | — | 6 |
| 2 | Extract identity routes | `PaginationQuerySchema`, body schemas from identity contract | 2 |
| 3 | Extract delivery routes | `ProviderConfigSchema`, `SuppressionSchema` body schemas | 2 |
| 4 | Extract analytics routes | `ReportSchema` body schemas | 2 |
| 5 | Extract remaining routes + slim app.tsx | — (pure proxy routes) | 11 |
| 6 | Scope middleware | — | 1 |
| 7 | Session caching | — | 2 |
| 8 | Slim GitHub Actions | — | 2 |
| 9 | Workers Builds script | — | 1 |
| 10 | Playwright E2E tests | — | 4 |
| 11 | ts-rest server-side in downstream workers | Full `@ts-rest/serverless` + contracts | 3+ |

**Dependency chain:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 (sequential gateway refactoring). Tasks 8, 9, 10 can run in parallel after Task 0. Task 11 can start after Task 5.
