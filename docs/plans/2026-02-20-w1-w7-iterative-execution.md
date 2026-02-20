# W1-W7 Iterative Execution Tracker

Date: 2026-02-20
Owner: Platform Team
Mode: Iterative (small vertical slices per turn)

## Rules

- DDD first: domain behavior in `packages/domains/*`; routes orchestrate only.
- Clean code: explicit ports/adapters, small functions, deterministic tests.
- Every slice ships with typecheck + lint + tests where applicable.
- Do not mark complete without production-path verification.

## Wave Status

### W1 - Delivery Foundation

- [x] Real DNS-based sending-domain verification in worker routes
  - `workers/delivery/src/services/dns-verification.ts`
  - `workers/delivery/src/interface/domain-routes.ts`
  - `workers/delivery/src/interface/dispatch-routes.ts`
- [x] Provider/fallback path confirmed in current HEAD (no net-new diff in this slice)
- [ ] Delivery provider matrix hardening (coverage for all supported provider configs)
- [ ] Delivery normalization parity tests (SES/SendGrid/Twilio webhook payload edge cases)

### W2 - Queue Reliability + Scoring

- [ ] Scoring API repos wired (`score/history/leaderboard`)
- [ ] Batch recompute implementation
- [ ] Signal decay implementation
- [ ] Alert expiry implementation
- [ ] DLQ replay tooling and runbook

### W3 - Journey Completeness

- [ ] Score/intent trigger execution creation (remove placeholders)
- [ ] Segment trigger evaluator to real execution start
- [ ] Journey goals/exit/re-entry/frequency controls
- [ ] Sequence step channel parity (email/sms/linkedin/task as designed)

### W4 - Governance + Identity + Audit

- [ ] Consent center and channel-level preferences
- [ ] Identity resolution primitives (external IDs and merge policy)
- [ ] Custom RBAC + field-level controls
- [ ] Immutable audit log rollout across critical write paths

### W5 - Analytics + Content Maturity

- [x] Funnel + attribution models
- [x] Dashboard/report completeness (remove placeholder payloads)
- [x] Reusable content blocks + experiments for forms/pages
- [x] Real-time contact timeline consolidation

### W6 - Enterprise + Integrations

- [x] SSO (SAML/OIDC) + SCIM
- [x] Integration marketplace/OAuth app model
- [x] Environment promotion workflow (dev/stage/prod)
- [x] CRM sync conflict policies and admin UX

### W7 - AI + Deliverability + RevOps Hardening

- [ ] AI assist (copy, copilot, explainability, next-best-action)
- [ ] Deliverability suite (seed/inbox placement + diagnostics)
- [ ] Forecast/risk reliability and calibration
- [ ] Release readiness checks and rollback drills

## Iteration 1 Outcome

- Implemented real DNS verification for sending domains in both public and dispatch routes.
- Verification now returns `allVerified` and `missingRecords`; domain remains `pending` until all records resolve.
- Validation commands passed:
  - `pnpm --filter @mauntic/delivery typecheck`
  - `pnpm --filter @mauntic/delivery lint`
  - `pnpm --filter @mauntic/delivery-domain test`
  - `pnpm --filter @mauntic/delivery-domain typecheck`
  - `pnpm --filter @mauntic/delivery-domain lint`

## Next Iteration Candidate (W1)

1. Add provider-config validation contract tests for SES/SendGrid/Twilio/FCM.
2. Add integration tests for `/sending-domains/:id/verify` with mocked DNS responses.
3. Implement provider compatibility guards at create/update time (channel vs provider type).

## Iteration 2 Outcome (W6 Slice 1: SSO Callback Completion)

- Replaced SSO callback placeholders with real provider callback handling in identity worker:
  - OIDC callback now resolves enabled connection, performs authorization-code exchange via domain service, enforces email-domain policy, and returns normalized authenticated profile payload
  - SAML callback now resolves enabled connection, parses assertion via domain service, enforces email-domain policy, and returns normalized authenticated profile payload
  - files:
    - `workers/identity/src/interface/sso-routes.ts`
    - `workers/identity/src/infrastructure/repositories/drizzle-sso-repository.ts`
- Hardened SSO init/callback correlation:
  - init state now binds to connection id (`<connectionId>:<nonce>`) for both OIDC and SAML entrypoints
  - callback handlers accept either explicit `connectionId` or state/relayState-derived connection id
- Added deterministic integration tests for callback flows:
  - OIDC success path
  - OIDC domain-mismatch guardrail
  - SAML success path
  - SAML invalid-assertion guardrail
  - init-state connection binding assertion
  - file:
    - `workers/identity/src/interface/sso-routes.callback.integration.test.ts`
- Added identity worker test wiring:
  - `workers/identity/package.json` adds `test` script + `vitest` dev dependency
- Validation commands passed:
  - `pnpm --filter @mauntic/identity test -- --runInBand`
  - `pnpm --filter @mauntic/identity typecheck`
  - `pnpm --filter @mauntic/identity exec biome check src/interface/sso-routes.ts src/interface/sso-routes.callback.integration.test.ts src/infrastructure/repositories/drizzle-sso-repository.ts`

## Next Iteration Candidate (W6)

1. Persist callback state/nonce in KV and validate replay/expiry in OIDC/SAML callbacks.
2. Add SCIM token model and `/scim/v2/Users` minimal CRUD (list/create/active patch) with org membership projection.
3. Wire SSO callback authenticated profile to actual session creation/link flow in Better Auth.

## Iteration 3 Outcome (W6 Slice 2: SSO Replay/Expiry + SCIM Baseline)

- Hardened SSO callback security with KV-backed one-time state storage/consumption:
  - init flow now persists OIDC/SAML callback state in KV with bounded TTL
  - callback flow now consumes state exactly once and blocks replay attempts
  - callback flow now distinguishes invalid/missing state vs expired state
  - files:
    - `workers/identity/src/application/sso-state-store.ts`
    - `workers/identity/src/interface/sso-routes.ts`
- Expanded deterministic callback integration coverage:
  - OIDC replay guard (second callback with same state rejected)
  - OIDC expired-state guard
  - SAML relay-state required guard
  - file:
    - `workers/identity/src/interface/sso-routes.callback.integration.test.ts`
- Added SCIM baseline in identity worker:
  - SCIM token model persisted in KV with hashed token lookup
  - tenant-admin token issuance endpoint: `POST /api/v1/identity/scim/tokens`
  - minimal SCIM Users endpoints:
    - `GET /scim/v2/Users`
    - `POST /scim/v2/Users`
    - `PATCH /scim/v2/Users/:id` (active replace semantics)
  - org membership projection implemented for active/inactive handling
  - files:
    - `workers/identity/src/application/scim-token-store.ts`
    - `workers/identity/src/application/scim-provisioning-service.ts`
    - `workers/identity/src/interface/scim-routes.ts`
    - `workers/identity/src/app.ts`
    - `workers/identity/src/interface/scim-routes.integration.test.ts`
- Validation commands passed:
  - `pnpm --filter @mauntic/identity test -- --runInBand`
  - `pnpm --filter @mauntic/identity typecheck`
  - `pnpm --filter @mauntic/identity exec biome check src/interface/scim-routes.ts src/interface/scim-routes.integration.test.ts src/application/scim-token-store.ts src/application/scim-provisioning-service.ts src/interface/sso-routes.ts src/interface/sso-routes.callback.integration.test.ts src/app.ts --write`

## Next Iteration Candidate (W6)

1. Wire SSO callback authenticated profile to Better Auth session creation/link flow (replace `nextAction` placeholder).
2. Expand SCIM coverage to include `GET /scim/v2/Users/:id` and membership role mapping parity.
3. Add SCIM token lifecycle endpoints (revoke/list metadata) and audit events for token issuance/use.

## Iteration 4 Outcome (W5 Completion: Analytics + Content)

- Completed funnel + attribution analytics APIs and dispatch parity:
  - public routes:
    - `workers/analytics/src/interface/event-routes.ts`
  - dispatch routes:
    - `workers/analytics/src/interface/dispatch-routes.ts`
  - repository support:
    - `workers/analytics/src/infrastructure/repositories/funnel-attribution-repository.ts`
- Removed placeholder payloads from dashboard/report surfaces:
  - typed report execution:
    - `workers/analytics/src/application/report-data-source.ts`
    - `workers/analytics/src/application/report-runner.ts`
    - `workers/analytics/src/interface/report-routes.ts`
    - `workers/analytics/src/interface/dispatch-routes.ts`
  - overview KPI completeness:
    - `workers/analytics/src/infrastructure/repositories/dashboard-repository.ts`
    - `workers/analytics/src/interface/dashboard-routes.ts`
- Reusable content blocks + experiment variants and timeline consolidation confirmed in current HEAD:
  - `workers/content/src/interface/template-routes.ts`
  - `workers/content/src/application/template-content-composition.ts`
  - `workers/analytics/src/application/contact-timeline-read-model.ts`
- Validation commands passed:
  - `pnpm --filter @mauntic/content test -- --runInBand`
  - `pnpm --filter @mauntic/content typecheck`
  - `pnpm --filter @mauntic/analytics test -- --runInBand`
  - `pnpm --filter @mauntic/analytics typecheck`

## Iteration 5 Outcome (W6 Completion: Enterprise + Integrations)

- Completed SSO callback to real session-link flow (replaced placeholder next-actions):
  - `workers/identity/src/application/sso-session-link.ts`
  - `workers/identity/src/interface/sso-routes.ts`
  - `workers/identity/src/infrastructure/better-auth.ts`
  - deterministic callback guardrails expanded:
    - `workers/identity/src/interface/sso-routes.callback.integration.test.ts`
- Expanded SCIM to full lifecycle admin + retrieval coverage:
  - admin lifecycle endpoints:
    - `GET /api/v1/identity/scim/tokens`
    - `DELETE /api/v1/identity/scim/tokens/:id`
  - user retrieval endpoint:
    - `GET /scim/v2/Users/:id`
  - role projection in SCIM resources:
    - `workers/identity/src/application/scim-provisioning-service.ts`
    - `workers/identity/src/interface/scim-routes.ts`
    - `workers/identity/src/interface/scim-routes.integration.test.ts`
- Added environment promotion workflow + CRM conflict policy admin APIs in integrations worker:
  - domain models:
    - `packages/domains/integrations-domain/src/entities/environment-promotion.ts`
    - `packages/domains/integrations-domain/src/entities/crm-conflict-policy.ts`
  - worker application stores and routes:
    - `workers/integrations/src/application/environment-promotion-store.ts`
    - `workers/integrations/src/application/crm-conflict-policy-store.ts`
    - `workers/integrations/src/interface/enterprise-routes.ts`
    - `workers/integrations/src/interface/enterprise-routes.integration.test.ts`
- Validation commands passed:
  - `pnpm --filter @mauntic/integrations-domain build`
  - `pnpm --filter @mauntic/integrations-domain test -- --runInBand`
  - `pnpm --filter @mauntic/integrations test -- --runInBand`
  - `pnpm --filter @mauntic/integrations typecheck`
  - `pnpm --filter @mauntic/identity test -- --runInBand`
  - `pnpm --filter @mauntic/identity typecheck`

## Next Iteration Candidate (W7)

1. Ship AI assist primitives (copy helper + explainability trail + next-best-action endpoint) with deterministic prompt-policy tests.
2. Implement deliverability diagnostics baseline (seed list orchestration + inbox placement aggregation + surfaced recommendations).
3. Add RevOps forecast/risk calibration checks and release-readiness rollback drill automation.
