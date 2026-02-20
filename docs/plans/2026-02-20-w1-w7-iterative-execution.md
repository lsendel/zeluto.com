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
