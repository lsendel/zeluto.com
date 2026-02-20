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

- [ ] Funnel + attribution models
- [ ] Dashboard/report completeness (remove placeholder payloads)
- [ ] Reusable content blocks + experiments for forms/pages
- [ ] Real-time contact timeline consolidation

### W6 - Enterprise + Integrations

- [ ] SSO (SAML/OIDC) + SCIM
- [ ] Integration marketplace/OAuth app model
- [ ] Environment promotion workflow (dev/stage/prod)
- [ ] CRM sync conflict policies and admin UX

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
