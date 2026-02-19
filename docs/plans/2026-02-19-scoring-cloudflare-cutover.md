# Scoring Engine Cloudflare Cutover (2026-02-19)

## Goal
Retire the Fly.io scoring engine (BullMQ workers + cron) by moving all scoring-related jobs into the existing Cloudflare Workers stack. This keeps per-contact scoring, batch recomputations, signal decay, and alert expiry entirely on Workers/Queues.

## Proposed Worker Layout
| Worker | Responsibility |
| --- | --- |
| `mauntic-scoring` (HTTP) | APIs + UI for scoring configuration (unchanged). Publishes per-contact jobs when needed. |
| `mauntic-scoring-queue` | Queue + cron worker. Consumes scoring jobs from `mauntic-scoring-events` and publishes domain events back onto the same queue (temporary) until a shared events bus is introduced. |

## Queue + Cron Wiring
- Reuse the existing `mauntic-scoring-events` queue as the scoring job queue to avoid provisioning churn. (Rename later once the global events bus exists.)
- Add `SCORING_JOBS` queue binding so cron triggers can enqueue structured job messages.
- Cron schedule equivalents:
  - `0 * * * *` → `scoring.BatchRecompute`
  - `0 * * * *` → `scoring.SignalDecay`
  - `*/15 * * * *` → `scoring.AlertExpiry`
- Queue message schema:

```ts
type ScoringJobMessage =
  | { type: 'scoring.CalculateScore'; data: { organizationId: string; contactId: string; context?: ScoringContext } }
  | { type: 'scoring.BatchRecompute' }
  | { type: 'scoring.SignalDecay' }
  | { type: 'scoring.AlertExpiry' };
```

## Work Items
1. ✅ Update `workers/scoring/src/queue.ts` to export a `scheduled` handler that maps cron expressions to the job types above and enqueues them via the scoring queue binding.
2. ✅ Extend `handleScoringQueue` to switch on the new job types (batch, signal decay, alert expiry). Initially call stub service functions that log + return success (parity with Fly placeholders).
3. ✅ Adjust wrangler configs:
   - `workers/scoring-queue/wrangler.toml`: add cron triggers + queue bindings for producers/consumers.
   - Keep the `EVENTS` producer for future domain events (still TODO once a dedicated bus exists).
4. ✅ Document cutover steps:
   - Deploy worker with cron disabled flag (`ENABLE_SCORING_CRON`) for smoke tests.
   - Enable cron and monitor `mauntic-scoring-events` (Cloudflare Queues tail + analytics).
   - Stop BullMQ workers + clear repeatable jobs in Fly after 24h clean run. (Fly scheduler now defaults to disabled via `DISABLE_SCHEDULER=true` so redeploys stay dark.)

## Current State (2026-02-19)
- Scoring queue worker consumes `mauntic-scoring-events` via Cloudflare Queues and supports all job types (calc, batch recompute, signal decay, alert expiry). Batch/decay/alert handlers still log placeholders until we port the Fly logic.
- Cron triggers exist in `workers/scoring-queue/wrangler.toml` (`0 * * * *` and `*/15 * * * *`) and `ENABLE_SCORING_CRON` now defaults to `"true"` (override via secret if you need to pause cron in a specific environment).
- Queue metrics flow through the shared logging middleware (`event = 'queue.metric'`), but Workers Analytics Engine dashboards still need scoring-specific filters.

## Cutover Runbook
1. **Pre-flight**
   - Verify Cloudflare queues: `wrangler queues list | grep mauntic-scoring-events`.
   - Deploy `mauntic-scoring-queue` with `ENABLE_SCORING_CRON=false` and confirm manual enqueue works:  
     `wrangler queues enqueue mauntic-scoring-events '{"type":"scoring.CalculateScore","data":{"organizationId":"org_123","contactId":"contact_456"}}'`.
2. **Shadow run**
   - Tail logs: `wrangler queues tail mauntic-scoring-events`.
   - Watch Workers Analytics Engine for `event = "queue.metric" AND queue = "mauntic-scoring-events"` to ensure retries stay near zero.
3. **Enable cron**
   - `wrangler secret put ENABLE_SCORING_CRON true` (default is `"true"` in `wrangler.toml`; set to `"false"` only for pauses).
   - Validate cron dispatch by checking for `scoring.BatchRecompute` / `scoring.AlertExpiry` messages in the queue tail.
4. **Decommission Fly cron**
   - On each Fly scoring worker (BullMQ), stop the repeatable jobs: `fly ssh console -C "node scripts/clear-repeatable-jobs.js"` or remove `registerScheduledJobs`.
   - Keep `DISABLE_SCHEDULER=true` (default) so redeploys do not restart the BullMQ jobs, then scale down/destroy the Fly service once Cloudflare has run cleanly for 24 hours.
5. **Post-cutover**
   - Update alerts/dashboards to pull only from Cloudflare metrics.
   - Remove BullMQ-specific environment variables/secrets from Fly configs.

## Follow-Ups
- Introduce a dedicated domain-events queue/binding so scoring domain events are delivered to the correct consumers instead of re-entering the jobs queue.
- Flesh out the batch scoring/signal decay logic using the repositories in `@mauntic/scoring-domain`.
- Wire HTTP routes to enqueue per-contact jobs (currently TODO in `score-routes.ts`).
