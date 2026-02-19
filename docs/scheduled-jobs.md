# Scheduled Jobs

This document lists all recurring jobs across the platform, including their runtime (Cloudflare Worker vs. Fly service), schedule, purpose, and failure behavior.

## Overview

- **Cloudflare Workers** (`mauntic-analytics-queue`, future queue workers) rely on Cloudflare Cron bindings + Queues. Cron dispatch is gated by worker-specific secrets (e.g., `ENABLE_ANALYTICS_CRON`) so we can shadow-run before retiring Fly.
- **Fly/BullMQ services** (`journey-executor`, etc.) still use `registerScheduledJobs()` from `@mauntic/process-lib` and BullMQ repeatable jobs.

## Worker: mauntic-analytics-queue (Cloudflare)

> **Status (2026-02-19):** Cloudflare is the source of truth for analytics aggregation/reporting. Cron triggers enqueue messages on `mauntic-analytics-jobs`, consumed by `src/queue-worker.ts`. `ENABLE_ANALYTICS_CRON` now defaults to `"true"` (override with a secret if you need to pause). Keep the Fly analytics-aggregator scaled down once Cloudflare jobs run cleanly for 24h.

### Hourly: Event Aggregation

| Property | Value |
|---|---|
| **Queue** | `mauntic-analytics-jobs` (type `analytics.aggregate-hourly`) |
| **Schedule** | `0 * * * *` (every hour at :00) |
| **Consumer** | `analytics.aggregateHourly` |
| **Purpose** | Aggregates the last hour of contact activity events into `analytics.event_aggregates` daily rollups (grouped by `organization_id` + `event_type`). Uses idempotent upserts keyed by (org, date, event type). |
| **Error Handling** | Failures trigger Cloudflare Queue retries (`max_retries = 5`, exponential backoff). Missed windows are re-aggregated on the next successful run. |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.event_aggregates` |

### Daily: Report Generation

| Property | Value |
|---|---|
| **Queue** | `mauntic-analytics-jobs` (type `analytics.generate-daily-reports`) |
| **Schedule** | `0 2 * * *` (daily at 2:00 AM) |
| **Consumer** | `analytics.generateDailyReports` |
| **Purpose** | Generates campaign daily stats for the prior day (sent/delivered/opened/clicked/bounced/complained/unsubscribed). Upserts rows in `analytics.campaign_daily_stats`. |
| **Error Handling** | Failures retry through the queue. Because writes are upserts keyed by `(campaign_id, organization_id, date)`, replays are safe. |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.campaign_daily_stats` |

### Daily: Warmup Daily Send Counter Reset

| Property | Value |
|---|---|
| **Queue** | `mauntic-analytics-jobs` (type `analytics.reset-warmup-daily`) |
| **Schedule** | `0 0 * * *` (daily at midnight) |
| **Consumer** | `analytics.resetWarmupCounters` |
| **Purpose** | Resets daily warmup counters stored in the `WARMUP_R2` bucket for domains created within the last 30 days. |
| **Error Handling** | Failures retry via the queue. Missing a reset blocks sending for warmup domains until the next successful run. |
| **Dependencies** | Reads from `delivery.sending_domains`, deletes objects from the `mauntic-warmup-counters` R2 bucket |

### Monthly: Usage Summary

| Property | Value |
|---|---|
| **Queue** | `mauntic-analytics-jobs` (type `analytics.generate-monthly-usage`) |
| **Schedule** | `0 3 1 * *` (1st of each month at 3:00 AM) |
| **Consumer** | `analytics.generateMonthlyUsage` |
| **Purpose** | Summarizes prior-month usage per organization/event type and upserts `monthly:{eventType}` metrics into `analytics.event_aggregates`. |
| **Error Handling** | Queue retries + idempotent upserts mean replays are safe. |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.event_aggregates` |

**Ops tips**

- Toggle cron dispatch: `wrangler secret put ENABLE_ANALYTICS_CRON true|false`.
- Pre-flight verification: `wrangler queues enqueue mauntic-analytics-jobs '{"type":"analytics.aggregate-hourly"}'`.
- Monitoring: `wrangler queues tail mauntic-analytics-jobs` + Workers Analytics Engine (`event = 'queue.metric' AND queue = 'mauntic-analytics-jobs'`).

## Worker: mauntic-scoring-queue (Cloudflare)

> **Status (2026-02-19):** Cron bindings are deployed and default to `ENABLE_SCORING_CRON=true` (override via secret if you need to pause). Message schema lives in `workers/scoring/src/queue/queue-handler.ts`. Batch/decay/alert handlers still log placeholders until Fly logic is ported, but Cloudflare now drives the schedule instead of Fly.

### Hourly: Batch Recompute

| Property | Value |
|---|---|
| **Queue** | `mauntic-scoring-events` (type `scoring.BatchRecompute`) |
| **Schedule** | `0 * * * *` |
| **Consumer** | `handleScoringQueue → runBatchRecompute` |
| **Purpose** | Recalculate all lead scores for orgs with pending recompute backlog. Current implementation logs a placeholder, but the structure is ready for repo wiring. |
| **Error Handling** | Queue retries (3 max) + alert via structured logging. Jobs include `scheduledFor` ISO timestamp for auditing. |

### Hourly: Signal Decay

| Property | Value |
|---|---|
| **Queue** | `mauntic-scoring-events` (type `scoring.SignalDecay`) |
| **Schedule** | `0 * * * *` |
| **Consumer** | `handleScoringQueue → runSignalDecay` |
| **Purpose** | Apply decay rules to stale engagement signals so scores trend down over time. Placeholder logs until repo logic lands. |

### Every 15 Minutes: Alert Expiry

| Property | Value |
|---|---|
| **Queue** | `mauntic-scoring-events` (type `scoring.AlertExpiry`) |
| **Schedule** | `*/15 * * * *` |
| **Consumer** | `handleScoringQueue → runAlertExpiry` |
| **Purpose** | Checks scoring alerts (e.g., high-score notifications) and marks them expired after SLAs. Current implementation logs stub entries. |

**Ops tips**

- Toggle cron dispatch: `wrangler secret put ENABLE_SCORING_CRON true|false`.
- Manual enqueue for smoke test: `wrangler queues enqueue mauntic-scoring-events '{"type":"scoring.CalculateScore","data":{"organizationId":"org_123","contactId":"contact_456"}}'`.
- Monitor: `wrangler queues tail mauntic-scoring-events` + Workers Analytics Engine filter `queue = "mauntic-scoring-events"`.

## Service: journey-executor (Fly/BullMQ)

### Hourly: Segment Trigger Evaluation

| Property | Value |
|---|---|
| **Queue** | `journey:segment-trigger-eval` |
| **Schedule** | `0 * * * *` (every hour at :00) |
| **Handler** | `segmentTriggerEvalHandler` |
| **Concurrency** | 1 |
| **Purpose** | Evaluates segment-based triggers for all active journeys. Finds all journey triggers with `type = 'segment'`, checks that the parent journey is active, then evaluates segment membership to determine if new contacts should enter the journey. |
| **Error Handling** | On failure, individual trigger evaluations are skipped but the job continues. The next hourly run will re-evaluate all triggers. Contacts that should have entered the journey will be picked up on the next successful evaluation. |
| **Dependencies** | Reads from `journey.journey_triggers`, `journey.journeys`. Evaluates segment criteria against CRM contacts (placeholder implementation). |

### Daily: Stale Execution Cleanup

| Property | Value |
|---|---|
| **Queue** | `journey:stale-execution-cleanup` |
| **Schedule** | `0 3 * * *` (daily at 3:00 AM) |
| **Handler** | `staleExecutionCleanupHandler` |
| **Concurrency** | 1 |
| **Purpose** | Finds and cancels journey executions that have been stuck in `active` status for more than 7 days. These executions are likely orphaned due to worker crashes or unhandled errors. Sets their status to `canceled` and logs a warning in `execution_logs`. |
| **Error Handling** | On failure, the job throws and BullMQ retries. If cleanup is missed, stale executions remain active but do not consume resources (they are simply database records). The next successful run will clean them up. |
| **Dependencies** | Reads/writes `journey.journey_executions`, writes `journey.execution_logs` |

## Service: delivery-engine (Fly/BullMQ)

The delivery engine does not currently register any scheduled jobs. All delivery processing is event-driven via BullMQ queues:

| Queue | Handler | Concurrency | Trigger |
|---|---|---|---|
| `delivery:send-email` | `emailHandler` | 5 | Campaign sends, journey email steps |
| `delivery:send-sms` | `smsHandler` | 3 | Campaign SMS sends, journey SMS steps |
| `delivery:send-push` | `pushHandler` | 10 | Campaign push sends, journey push steps |

## Job Failure Behavior

- **Cloudflare Queues:** Controlled via the consumer configuration in each worker (`max_batch_size`, `max_retries`, exponential backoff). Failed messages remain visible in tail + Workers Analytics dataset.
- **BullMQ jobs:** Use the defaults below (configurable via `defaultJobOptions`).

| Setting | Default Value | Notes |
|---|---|---|
| **Max retries** | 3 | Configurable per queue via `defaultJobOptions` |
| **Backoff type** | Exponential | 1s, 2s, 4s delays |
| **Remove on complete** | true | Completed jobs are removed after 1 hour |
| **Remove on fail** | false | Failed jobs remain for debugging |

### Dead Letter Queue

Failed jobs that exceed max retries should be monitored via the DLQ monitoring system (see `packages/process-lib/src/bullmq/dlq-monitor.ts`). Critical scheduled job failures should trigger alerts via the monitoring infrastructure.

## Cron Schedule Summary

| Time | Worker/Service | Job | Runtime |
|---|---|---|---|
| `0 * * * *` | mauntic-analytics-queue | Hourly event aggregation | Cloudflare Cron → Queue |
| `0 * * * *` | mauntic-scoring-queue | Batch recompute & signal decay | Cloudflare Cron → Queue |
| `0 * * * *` | journey-executor | Segment trigger evaluation | Fly/BullMQ |
| `0 0 * * *` | mauntic-analytics-queue | Warmup daily counter reset | Cloudflare Cron → Queue |
| `0 2 * * *` | mauntic-analytics-queue | Daily report generation | Cloudflare Cron → Queue |
| `0 3 * * *` | journey-executor | Stale execution cleanup | Fly/BullMQ |
| `0 3 1 * *` | mauntic-analytics-queue | Monthly usage summary | Cloudflare Cron → Queue |
| `*/15 * * * *` | mauntic-scoring-queue | Alert expiry sweep | Cloudflare Cron → Queue |

## Analytics Cutover Checklist

1. Ensure `mauntic-analytics-jobs` + DLQ exist in Cloudflare Queues.
2. (Optional shadow run) Override `ENABLE_ANALYTICS_CRON=false` via secret, deploy `@mauntic/analytics-queue`, and monitor manual enqueues.
3. Set/confirm `ENABLE_ANALYTICS_CRON=true`, tail the queue + Workers Analytics dataset.
4. After 24h of healthy runs, keep the Fly `analytics-aggregator` app scaled down or set `DISABLE_SCHEDULER=true` (default) so it no longer registers jobs.
5. Update this file + the runbook if cron patterns change.

## Adding New Scheduled Jobs

To add a new scheduled job:

1. Define a `JobHandler` with a unique name in the appropriate service
2. Register it via `registerScheduledJobs()` with a cron pattern
3. Create a BullMQ worker for the queue
4. Document the job in this file
5. Add monitoring/alerting for failures

```typescript
import { registerScheduledJobs, createWorker, type JobHandler } from '@mauntic/process-lib';

const myHandler: JobHandler = {
  name: 'my-service:my-job',
  concurrency: 1,
  async process(job) {
    // Job logic here
    return { success: true };
  },
};

// In main():
await registerScheduledJobs('my-service:my-job', [
  { name: 'my-scheduled-task', pattern: '0 4 * * *' }, // Daily at 4 AM
]);
const worker = createWorker('my-service:my-job', myHandler);
```
