# Dispatch Namespaces Rollout (2026-02-19)

## Goals
- Replace HTTP-style service bindings (`fetcher.fetch(...)`) with Workers Modules/Dispatch namespaces so inter-worker calls become direct module exports with shared types, lower latency, and no redundant auth headers.
- Prioritize the highest-traffic call paths:
  1. **Gateway → domain workers** (`/api/v1/*` fan-out).
  2. **Campaign → CRM** segment contact source.

## Proposed Architecture
1. **Publish modules from service workers**
   - Each worker exposes a module entry (e.g., `src/module.ts`) exporting typed handlers. Example for CRM segments:
     ```ts
     export async function querySegment(env: Env, input: { organizationId: string; segmentId: string; cursor?: string; limit: number }) {
       // validate, call router, return { contacts, total, nextCursor }
     }
     ```
   - HTTP entry remains for public APIs; module exports run in the same bundle to serve dispatch calls.
2. **Register dispatch namespaces in wrangler config**
   - `wrangler.project.toml`:
     ```toml
     [[project.dispatch_namespaces]]
     binding = "CRM_DISPATCH"
     namespace = "mauntic-crm"
     ```
   - `workers/campaign/wrangler.toml`:
     ```toml
     [[dispatch_namespaces]]
     binding = "CRM_DISPATCH"
     namespace = "mauntic-crm"
     ```
   - Gateway needs a namespace per downstream worker (or a generic dispatch router that picks target by string).
3. **Client adapters**
   - New helpers in `packages/worker-clients/dispatch.ts` to wrap dispatch namespace calls and surface typed methods (fallback to service binding fetch when running locally until all deployments updated).
   - Example:
     ```ts
     export function createCrmDispatchClient(namespace?: DispatchNamespace, fetcher?: Fetcher) {
       if (namespace) {
         return {
           querySegment: (input) => namespace.dispatch('querySegment', input),
         };
       }
       if (fetcher) return createServiceBindingClient(fetcher, {...});
       throw new Error('CRM dispatch unavailable');
     }
     ```
4. **Gradual migration**
   - Phase 1: CRM worker exports dispatch module; campaign worker tries dispatch first, falls back to HTTP binding.
   - Phase 2: Gateway routes adopt dispatch, endpoints remove manual header plumbing.
   - Phase 3: Remove legacy service binding logic once all consumers move over.

## Deliverables
- CRM dispatch module scaffold (segments query as first function).
- Shared dispatch client helper with fallback.
- Updated wrangler config for CRM + campaign (namespace + `dispatch = "module"` entry).
- Gateway plan for multi-service dispatch (likely `bindings` map + generic router).

### Status (2026-02-19)
- ✅ CRM worker exposes an internal dispatch endpoint (`POST /__dispatch/crm/segments/query`) backed by the same repository logic as the public route (`querySegmentContacts`).
- ✅ Campaign worker now prefers the `CRM_DISPATCH` binding (falls back to HTTP `/segments/:id/query` if dispatch fails), so fan-out leverages the new RPC path transparently.
- ✅ Gateway intercepts `/api/v1/crm/segments/:segmentId/query` and hits the same dispatch endpoint first before falling back to the legacy proxy, so user-facing APIs already benefit from the new module path.
- ✅ `workers/campaign/wrangler.toml` includes a dedicated `CRM_DISPATCH` binding; `segment-contact-source.ts` handles credential headers + tenant context consistently.
- ✅ Billing worker exposes `/__dispatch/billing/subscription/get`, and the gateway’s `/api/v1/me` route now prefers the `BILLING_DISPATCH` binding before falling back to the HTTP service binding.
- ✅ Identity worker now exposes `/__dispatch/identity/session/validate`, and the gateway auth middleware calls this dispatch endpoint (falling back to `/api/auth/session` only if dispatch fails), reducing double hops for every authenticated request.
- ✅ Identity dispatch module now handles user profile updates, role changes, block/unblock operations, organization list/create/update/switch flows, and member pagination; the gateway intercepts the corresponding `/api/v1/identity/*` routes to call dispatch first with HTTP fallback kept only for missing bindings.
- ✅ Invite CRUD + organization deletion now run exclusively through identity dispatch, and the gateway proxies for `/api/v1/identity/organizations/:id/*` invite routes plus `/api/v1/identity/invites/:token/accept` prefer dispatch, eliminating HTTP service binding hops during onboarding/admin workflows.
- ✅ Per-user reads and member removal endpoints moved to dispatch, so the gateway no longer keeps a blanket `/api/v1/identity/*` HTTP fallback—identity traffic is now 100% dispatch-first with explicit handlers for every route the gateway exposes.
- ✅ Delivery worker now exposes `/__dispatch/delivery/*` helpers for sending-domain management, provider configs (list/get/create/update/delete/test), and delivery job summaries; the gateway binds `DELIVERY_DISPATCH` and prefers it for `/api/v1/delivery/sending-domains*`, `/api/v1/delivery/providers*`, and `/api/v1/delivery/jobs*` before falling back to HTTP.
- ✅ Analytics worker now exposes `/__dispatch/analytics/*` endpoints for dashboards, events, and report management; the gateway binds `ANALYTICS_DISPATCH` and calls dispatch for `/api/v1/analytics/overview`, `/events*`, and `/reports*` routes before attempting the HTTP binding.
- 🔄 Gateway still proxies most `/api/v1/*` traffic over raw HTTP service bindings (identity, journey, delivery, etc.); extend the dispatch adapter pattern to those workers next.

## Risks / Considerations
- Dispatch is currently in beta: keep HTTP fallback until CF GA.
- Module exports share the same runtime as HTTP worker; keep module functions side-effect free and reuse existing repositories/services.
- Access control still relies on tenant context; dispatch invocation must include metadata (organization id, roles) instead of raw headers. Consider serializing the existing `TenantContext` into the dispatch request payload.

## Next Endpoints To Convert
1. Gateway → Delivery: remaining endpoints (suppressions, warmup schedules, webhook ingestion) still proxy via HTTP; add dispatch handlers or document why they should remain HTTP-only.
2. Gateway → Identity: profile + org management now run over dispatch; remaining endpoints (invites, org deletion, per-user reads) still proxy over HTTP until matching dispatch functions land.
3. Gateway → Delivery + Analytics workers for `/views/*` fragments (reduce latency for HTMX renderers).
4. CRM → Scoring/Lead Intelligence (when those workers begin calling back into CRM for enrichment data).

Document progress in this file as each namespace goes live so platform ops can retire legacy service bindings when safe.
