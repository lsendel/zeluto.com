# CI/CD Migration + Gateway Architecture Refactoring

**Date:** 2026-02-19
**Status:** Draft
**Depends on:** [Cloudflare Deployments Update](./2026-02-20-cloudflare-deployments-update.md)

---

## 1. Problem Statement

Three categories of improvement were identified during the registration-bug investigation:

| Area | Problem | Impact |
|------|---------|--------|
| **CI/CD** | Two overlapping GitHub Actions workflows (`ci.yml` + `cloudflare-workers.yml`) deploy 20 workers via matrix. User wants Cloudflare-native builds. | Slow deploys (~8min), GitHub dependency, no canary/rollback |
| **Gateway architecture** | `app.tsx` is 1448 lines with ~85 routes, 3 duplicated dispatch helpers, 5 near-identical payload parsers | Hard to maintain, easy to introduce bugs (registration bug was partly caused by this) |
| **Middleware performance** | Auth calls Identity Worker on every request; CSRF/quota/rate-limit scoped too broadly | Unnecessary latency on public/static paths, wasted compute |

---

## 2. CI/CD: Cloudflare Workers Builds

### 2.1 Current State

- **`ci.yml`**: typecheck → lint → test → build → deploy 13 workers + 5 Fly.io services
- **`cloudflare-workers.yml`**: lint+typecheck → deploy 20 workers (preview on PR, production on main push)
- Both install full monorepo (`pnpm install --frozen-lockfile`) for each matrix job
- Uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets

### 2.2 Workers Builds Constraints (pnpm monorepo)

Workers Builds has limitations with pnpm monorepos:

1. **No native pnpm support** — Uses `npm install` by default; must set `SKIP_DEPENDENCY_INSTALL=true` and run custom install
2. **One build config per worker** — Each of the 21 workers needs a separate Cloudflare dashboard project
3. **No matrix/fan-out** — Unlike GitHub Actions, no way to define a matrix of workers
4. **Build caching** — Beta, unreliable with pnpm workspaces
5. **Watch paths** — Must be configured per project to avoid rebuilding all workers on every push

### 2.3 Recommended Approach: Hybrid

Given 21 workers and the pnpm limitations, a pure Workers Builds migration is operationally heavy. Instead:

**Phase 1 — Keep GitHub Actions for quality gates (lint, typecheck, test)**
These run once across the monorepo and are cheap. Workers Builds doesn't support this well.

**Phase 2 — Migrate deploys to Workers Builds**
Each worker gets a Cloudflare Deployments project with:

```
# Build command (per worker)
SKIP_DEPENDENCY_INSTALL=true

# Custom build command example (gateway):
npm i -g pnpm@10 && pnpm install --frozen-lockfile --filter @mauntic/gateway... && pnpm --filter @mauntic/gateway build
```

Watch paths scoped to prevent unnecessary rebuilds:
- `workers/gateway/**` for gateway
- `packages/worker-lib/**` for shared lib changes (triggers all workers)
- `packages/ui-kit/**` for gateway only

**Phase 3 — Remove GitHub Actions deploy jobs**
Keep only the quality-gate workflow. Delete `cloudflare-workers.yml` entirely.

### 2.4 Worker → Cloudflare Project Mapping

| Worker | Watch Paths | Notes |
|--------|------------|-------|
| `mauntic-gateway` | `workers/gateway/`, `packages/worker-lib/`, `packages/ui-kit/` | Static assets pre-deploy hook |
| `mauntic-identity` | `workers/identity/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-tenant-cache` | `workers/tenant-cache/`, `packages/worker-lib/` | Must deploy before others |
| `mauntic-billing` | `workers/billing/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-crm` | `workers/crm/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-content` | `workers/content/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-campaign` | `workers/campaign/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-campaign-queue` | `workers/campaign-queue/`, `workers/campaign/src/queue.ts` | Shares queue.ts with campaign |
| `mauntic-journey` | `workers/journey/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-journey-queue` | `workers/journey-queue/`, `workers/journey/src/queue.ts` | |
| `mauntic-delivery` | `workers/delivery/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-delivery-queue` | `workers/delivery-queue/`, `workers/delivery/src/queue.ts` | |
| `mauntic-analytics` | `workers/analytics/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-analytics-queue` | `workers/analytics-queue/`, `workers/analytics/src/queue.ts` | |
| `mauntic-integrations` | `workers/integrations/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-lead-intelligence` | `workers/lead-intelligence/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-lead-intelligence-queue` | `workers/lead-intelligence-queue/`, `workers/lead-intelligence/src/queue.ts` | |
| `mauntic-scoring` | `workers/scoring/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-scoring-queue` | `workers/scoring-queue/`, `workers/scoring/src/queue.ts` | |
| `mauntic-revops` | `workers/revops/`, `packages/worker-lib/`, `packages/db/` | |
| `mauntic-revops-queue` | `workers/revops-queue/`, `workers/revops/src/queue.ts` | |

### 2.5 Deployment Script

To automate the 21 dashboard configurations, create a Wrangler-based deploy script:

```bash
# scripts/setup-workers-builds.sh
# Uses wrangler CLI to create/update Workers Builds config per worker
# Iterates workers/*/wrangler.toml, extracts name, sets watch paths
```

### 2.6 What Gets Deleted

- `.github/workflows/cloudflare-workers.yml` — entirely
- `.github/workflows/ci.yml` — remove `deploy-workers` and `deploy-services` jobs, keep quality gates

---

## 3. Gateway Architecture Refactoring

### 3.1 Current Problems

**`workers/gateway/src/app.tsx`** (1448 lines):

1. **3 duplicated dispatch helpers** (`identityDispatchRequest`, `deliveryDispatchRequest`, `analyticsDispatchRequest`) — all follow the same pattern: check dispatch binding → check tenant → build headers → POST to `/__dispatch/{service}/{endpoint}` → fallback to `forwardToService()`

2. **5 near-identical payload parsers** (`parseOrganizationPayload`, `parseDeliveryDomainPayload`, `parseDeliveryProviderPayload`, `parseDeliveryProviderTestPayload`, `parseDeliverySuppressionPayload`) — all do: check Content-Type → parse JSON or form data → extract typed fields

3. **~85 route handlers** inline in one function — CRM, delivery, campaigns, journeys, analytics, billing, identity, content, integrations, lead intelligence, scoring, revops all defined in `createApp()`

4. **Middleware applied via `app.use('*')` for everything** — auth, tenant, CSRF all run on static assets and health checks

### 3.2 Proposed Structure

```
workers/gateway/src/
├── app.tsx                    # Slim: middleware + route mounting (~100 lines)
├── index.ts                   # Worker entry
├── routes/
│   ├── onboarding.tsx         # Already extracted ✓
│   ├── identity.ts            # /api/v1/identity/* routes
│   ├── crm.ts                 # /api/v1/crm/* routes
│   ├── delivery.ts            # /api/v1/delivery/* routes
│   ├── campaign.ts            # /api/v1/campaign/* routes
│   ├── journey.ts             # /api/v1/journey/* routes
│   ├── analytics.ts           # /api/v1/analytics/* routes
│   ├── billing.ts             # /api/v1/billing/* routes
│   ├── content.ts             # /api/v1/content/* routes
│   ├── integrations.ts        # /api/v1/integrations/* routes
│   ├── lead-intelligence.ts   # /api/v1/lead-intelligence/* routes
│   ├── scoring.ts             # /api/v1/scoring/* routes
│   ├── revops.ts              # /api/v1/revops/* routes
│   └── pages.tsx              # /app/* SSR page routes
├── middleware/
│   ├── auth.ts                # Existing ✓
│   ├── tenant.ts              # Existing ✓
│   ├── rate-limit.ts          # Existing ✓
│   └── quota.ts               # Existing ✓
└── lib/
    ├── dispatch.ts            # Generic dispatchRequest() replacing 3 copies
    ├── forward.ts             # forwardToService() extracted
    └── parse-payload.ts       # Generic parsePayload<T>() replacing 5 copies
```

### 3.3 Generic Dispatch Helper

Replace 3 duplicated functions with one:

```typescript
// lib/dispatch.ts
export async function dispatchRequest(
  c: Context<Env>,
  service: { dispatch?: Fetcher; http: Fetcher },
  endpoint: string,
  payload: Record<string, unknown>,
  options?: { skipTenant?: boolean },
): Promise<Response | null> {
  const dispatch = service.dispatch;
  if (!dispatch) return null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': c.get('requestId') ?? crypto.randomUUID(),
  };

  if (!options?.skipTenant) {
    const tenant = c.get('tenantContext');
    if (!tenant) return null;
    headers['X-Tenant-Context'] = encodeTenantHeader(tenant);
  }

  const serviceName = endpoint.split('/')[0]; // e.g., "users" from "users/list"
  const url = `https://internal/__dispatch/${serviceName}/${endpoint}`;

  try {
    const res = await dispatch.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return new Response(res.body, res);
  } catch {
    return null; // fallback to forwardToService
  }
}
```

Usage in route modules:
```typescript
// routes/identity.ts
app.get('/api/v1/identity/users', async (c) => {
  const { page, limit, search } = parseSearchParams(c);
  return await dispatchRequest(c,
    { dispatch: c.env.IDENTITY_DISPATCH, http: c.env.IDENTITY },
    'users/list', { page, limit, search }
  ) ?? forwardToService(c, c.env.IDENTITY);
});
```

### 3.4 Generic Payload Parser

Replace 5 duplicated functions with one:

```typescript
// lib/parse-payload.ts
export async function parsePayload<T extends Record<string, unknown>>(
  c: Context,
  fields: (keyof T)[],
): Promise<Partial<T>> {
  const contentType = c.req.header('Content-Type') ?? '';
  const raw = contentType.includes('application/json')
    ? await c.req.json().catch(() => ({}))
    : await c.req.parseBody();

  const result: Partial<T> = {};
  for (const field of fields) {
    const value = (raw as any)?.[field];
    if (typeof value === 'string') {
      (result as any)[field] = value;
    }
  }
  return result;
}
```

### 3.5 Slim app.tsx

After extraction, `app.tsx` becomes ~100 lines:

```typescript
export function createApp() {
  const app = new Hono<Env>();

  // Middleware stack
  app.use('*', corsMiddleware([...]));
  app.use('*', loggingMiddleware('gateway'));
  app.use('*', authMiddleware());
  app.use('*', tenantMiddleware());
  app.use('*', csrfMiddleware());
  app.use('/api/*', rateLimitMiddleware());
  app.use('/api/v1/*', quotaMiddleware());

  // Health + assets
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/assets/*', staticAssetsHandler);

  // Route modules
  app.route('/app/onboarding', createOnboardingRoutes());
  app.route('/api/v1/identity', identityRoutes);
  app.route('/api/v1/crm', crmRoutes);
  app.route('/api/v1/delivery', deliveryRoutes);
  // ... remaining service routes ...

  // SSR page routes
  app.route('/app', pageRoutes);

  return app;
}
```

---

## 4. Middleware Performance Improvements

### 4.1 Auth Middleware: Skip Public Paths Earlier

**Current:** Auth middleware runs on every request including `/assets/*`, `/health`, `/favicon.ico`.
**Fix:** The middleware already has `PUBLIC_PATHS` and `PUBLIC_PREFIXES` but they're checked after some setup. Ensure the early return is truly the first thing.

### 4.2 Scoped Middleware Application

**Current:** All middleware runs on `*` (every request).
**Fix:** Apply expensive middleware only where needed:

```typescript
// Instead of app.use('*', authMiddleware())
// Apply auth only to /api/* and /app/* paths
app.use('/api/*', authMiddleware());
app.use('/app/*', authMiddleware());

// Tenant context only for API routes that need it
app.use('/api/v1/*', tenantMiddleware());

// CSRF only for non-API mutation routes
app.use('/app/*', csrfMiddleware());
```

This means `/health`, `/assets/*`, and `/api/auth/*` skip auth+tenant+CSRF entirely at the Hono routing level rather than via internal checks.

### 4.3 Session Validation Caching

**Current:** Every authenticated request calls Identity Worker's `/__dispatch/session/validate`.
**Fix:** Cache validated sessions in the gateway for a short TTL:

```typescript
// In auth middleware:
const cacheKey = `session:${sessionToken}`;
const cached = await c.env.KV.get(cacheKey, 'json');
if (cached) {
  c.set('user', cached.user);
  c.set('organization', cached.organization);
  return next();
}
// ... validate with Identity Worker, then cache for 60s ...
await c.env.KV.put(cacheKey, JSON.stringify({ user, organization }), { expirationTtl: 60 });
```

### 4.4 Tenant Context: Avoid Redundant Lookups

**Current:** Tenant middleware fetches org data even on `TENANT_OPTIONAL_PREFIXES` paths.
**Fix:** Skip the Durable Object/KV lookup entirely for paths that don't need tenant context. Let the route handler request it explicitly if needed.

---

## 5. Test Coverage Strategy

### 5.1 Current State

Minimal unit test coverage. No E2E tests.

### 5.2 Approach

**Unit tests (Vitest):**
- Test each route module in isolation with mocked service bindings
- Test middleware functions with mocked contexts
- Test utility functions (dispatch, parse-payload, etc.)
- Target: 80% line coverage on `workers/gateway/src/`

**E2E tests (Playwright):**
- Signup → create org → dashboard flow
- Login → navigate all app pages
- OAuth callback handling
- Error states (invalid credentials, network errors)
- Target: All pages visited, critical flows exercised

### 5.3 Test Infrastructure

```
tests/
├── unit/
│   ├── gateway/
│   │   ├── routes/        # Route module tests
│   │   ├── middleware/    # Middleware tests
│   │   └── lib/           # Utility tests
│   └── identity/          # Identity Worker tests
└── e2e/
    ├── auth.spec.ts       # Signup/login/logout
    ├── onboarding.spec.ts # Org creation + plan selection
    ├── dashboard.spec.ts  # Dashboard page visits
    └── navigation.spec.ts # All page coverage
```

---

## 6. Execution Order

| Phase | Work | Depends On | Est. Scope |
|-------|------|-----------|------------|
| **0** | Commit registration bug fixes (already done) | — | 1 commit |
| **1** | Gateway route extraction (modularize app.tsx) | Phase 0 | 13 new files |
| **2** | Generic dispatch + payload parser | Phase 1 | 2 new files |
| **3** | Middleware scoping (auth/tenant/CSRF) | Phase 1 | 3 file edits |
| **4** | Session caching in auth middleware | Phase 3 | 1 file edit |
| **5** | Unit tests for gateway routes + middleware | Phase 2 | ~15 test files |
| **6** | E2E tests with Playwright | Phase 0 | ~4 test files |
| **7** | Workers Builds migration (dashboard setup) | Phase 0 | Config + script |
| **8** | Remove GitHub Actions deploy jobs | Phase 7 | 2 file edits |

Phases 5-8 can run in parallel once Phase 2 is complete.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Workers Builds pnpm install is slow (installs full monorepo) | Use `SKIP_DEPENDENCY_INSTALL=true` + scoped `pnpm install --filter` |
| Route extraction changes request handling subtly | Test each route module against current behavior before removing old code |
| Session caching serves stale data after logout | Use short TTL (60s) + delete cache key on `/api/auth/sign-out` |
| 21 Cloudflare dashboard configs to manage | Create setup script; document in runbook |
| Middleware scoping breaks edge cases | Run existing test suite + manual browser test before/after |
