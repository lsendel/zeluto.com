# Analytics Worker Cloudflare Cutover (2026-02-19)

## Current State
- HTTP entrypoint already split from queue entrypoint inside `workers/analytics`.
- `mauntic-analytics-queue` worker publishes/consumes `mauntic-analytics-jobs` with cron dispatch enabled (`ENABLE_ANALYTICS_CRON=true` by default so Cloudflare owns the schedule).
- Warmup counter resets now use an R2 bucket (`WARMUP_R2`) inside the queue worker; Redis is no longer required.

## Cloudflare Requirements
1. **Database access**
   - `DATABASE_URL` secret (Neon connection string) for the queue worker.
   - Hyperdrive binding optional; direct serverless driver works today.
2. **Analytics job queue**
   - Cloudflare Queue `mauntic-analytics-jobs` with DLQ `mauntic-analytics-jobs-dlq`.
   - Producer + consumer bindings wired in `workers/analytics-queue/wrangler.toml`.
3. **Cron scheduling**
   - Cron patterns mirroring Fly jobs:
     - `0 * * * *` hourly aggregation.
     - `0 2 * * *` daily reports.
     - `0 0 * * *` warmup reset.
     - `0 3 1 * *` monthly usage.
     - `0 4 * * *` score distributions.
     - `0 5 * * *` enrichment metrics.
   - Flag to keep cron disabled until ready: `ENABLE_ANALYTICS_CRON` env var.
4. **Warmup counter store**
   - Replace Redis with Workers-native storage (R2 bucket) that supports `resetDailyCounter(orgId, domain)` semantics.
5. **Secrets + shared bindings**
   - Access to tenant DO (TENANT_CACHE) is optional for now; not required for these jobs.
   - Observability via `logQueueMetric` already baked in; need Workers Analytics Engine sink later.

## Next Actions
- Wire cron triggers inside `workers/analytics-queue/wrangler.toml`. ✅
- Implement a Workers-backed `WarmupCounterStore` implementation and inject into queue worker. ✅
- Document cutover steps (enable cron flag, stop Fly job scheduler, monitor queue metrics). ✅
- Enable cron permanently (`ENABLE_ANALYTICS_CRON=true`) and bind the R2 warmup bucket to the queue worker. ✅
- (Complete): Fly `analytics-aggregator` app has been destroyed; Cloudflare owns cron + aggregation end-to-end.

## Cutover Runbook
1. **Pre-flight**
   - `wrangler queues create mauntic-analytics-jobs` and `mauntic-analytics-jobs-dlq` (or verify existing).
   - `wrangler r2 bucket create mauntic-warmup-counters` (preview bucket: `mauntic-warmup-counters-dev`), then link the bucket to the worker as `WARMUP_R2`.
   - `wrangler secret put DATABASE_URL` for `mauntic-analytics-queue`.
2. **Deploy queue worker**
   - `pnpm --filter @mauntic/analytics-queue build` (dry-run deploy) then `wrangler deploy --env <stage>` referencing `wrangler.project.toml`.
   - Keep `ENABLE_ANALYTICS_CRON` at `"false"` initially (secret override) if you need a shadow period; enqueue a manual job via `wrangler queues enqueue mauntic-analytics-jobs '{"type":"analytics.aggregate-hourly"}'` to ensure connections work.
3. **Enable Cloudflare cron**
   - `wrangler secret put ENABLE_ANALYTICS_CRON true` (defaults to `"true"` in `wrangler.toml` now; set to `"false"` only if you need to pause).
   - Monitor `wrangler queues tail mauntic-analytics-jobs` plus Workers Analytics Engine metrics for retries/failures.
4. **Disable Fly schedulers**
   - (Historical) These steps were completed on 2026-02-19 when the Fly `analytics-aggregator` was torn down. No Fly services remain for analytics.
5. **Post-cutover**
   - Remove Redis dependency from the analytics aggregator service (obsolete now that the service is deleted).
   - Update `docs/scheduled-jobs.md` to mark Fly jobs deprecated once Fly service is torn down. ✅
