# Scheduled Jobs

This document lists all BullMQ repeatable jobs across all Fly.io services, including their schedule, purpose, and error handling behavior.

## Overview

All scheduled jobs are registered via `registerScheduledJobs()` from `@mauntic/process-lib`. They use BullMQ's `upsertJobScheduler` with cron patterns and are automatically managed by the respective service's BullMQ workers.

## Service: analytics-aggregator

### Hourly: Event Aggregation

| Property | Value |
|---|---|
| **Queue** | `analytics:aggregate-hourly` |
| **Schedule** | `0 * * * *` (every hour at :00) |
| **Handler** | `hourlyAggregationHandler` |
| **Concurrency** | 1 |
| **Purpose** | Aggregates raw contact activity events from the last hour into `analytics.event_aggregates` daily rollups. Groups events by `organization_id` and `event_type`, then upserts counts into the aggregates table for the current date. |
| **Error Handling** | On failure, the job throws and BullMQ retries with default backoff. The next hourly run will re-aggregate the missed window (idempotent upsert pattern). |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.event_aggregates` |

### Daily: Report Generation

| Property | Value |
|---|---|
| **Queue** | `analytics:generate-daily-reports` |
| **Schedule** | `0 2 * * *` (daily at 2:00 AM) |
| **Handler** | `dailyReportHandler` |
| **Concurrency** | 1 |
| **Purpose** | Generates campaign daily stats rollups for the previous day. Reads contact activity events from yesterday, groups by campaign (via `event_source`), and inserts rows into `analytics.campaign_daily_stats` with sent/delivered/opened/clicked/bounced/complained/unsubscribed counts. |
| **Error Handling** | On failure, the job throws and BullMQ retries. Since it writes for a specific date, re-runs for the same day may create duplicate rows. Idempotency should be added via upsert on `(campaign_id, organization_id, date)`. |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.campaign_daily_stats` |

### Daily: Warmup Daily Send Counter Reset

| Property | Value |
|---|---|
| **Queue** | `analytics:warmup-daily-reset` |
| **Schedule** | `0 0 * * *` (daily at midnight) |
| **Handler** | `warmupResetHandler` |
| **Concurrency** | 1 |
| **Purpose** | Resets daily send counters in Redis for domains in their warmup period (created within last 30 days). Clears `warmup:daily:{orgId}:{domain}` keys so that warmup limits are enforced per-day. |
| **Error Handling** | On failure, the job throws and BullMQ retries. If the reset is missed, sending will be blocked for warmup domains until the next successful run. This is a conservative failure mode (prevents over-sending). |
| **Dependencies** | Reads from `delivery.sending_domains`, deletes keys from Redis |

### Monthly: Usage Summary

| Property | Value |
|---|---|
| **Queue** | `analytics:monthly-usage-summary` |
| **Schedule** | `0 3 1 * *` (1st of each month at 3:00 AM) |
| **Handler** | `monthlyUsageHandler` |
| **Concurrency** | 1 |
| **Purpose** | Generates monthly usage summaries per organization. Counts all events for the previous month grouped by `organization_id` and `event_type`, then stores them as `monthly:{eventType}` entries in `analytics.event_aggregates`. Used for billing usage reports and historical dashboards. |
| **Error Handling** | On failure, BullMQ retries. Since it uses the previous month's date range, re-runs are idempotent if using upsert. Currently uses insert, so duplicate runs may create duplicate rows. |
| **Dependencies** | Reads from `analytics.contact_activity`, writes to `analytics.event_aggregates` |

## Service: journey-executor

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

## Service: delivery-engine

The delivery engine does not currently register any scheduled jobs. All delivery processing is event-driven via BullMQ queues:

| Queue | Handler | Concurrency | Trigger |
|---|---|---|---|
| `delivery:send-email` | `emailHandler` | 5 | Campaign sends, journey email steps |
| `delivery:send-sms` | `smsHandler` | 3 | Campaign SMS sends, journey SMS steps |
| `delivery:send-push` | `pushHandler` | 10 | Campaign push sends, journey push steps |

## Job Failure Behavior

All scheduled jobs use BullMQ's default retry behavior:

| Setting | Default Value | Notes |
|---|---|---|
| **Max retries** | 3 | Configurable per queue via `defaultJobOptions` |
| **Backoff type** | Exponential | 1s, 2s, 4s delays |
| **Remove on complete** | true | Completed jobs are removed after 1 hour |
| **Remove on fail** | false | Failed jobs remain for debugging |

### Dead Letter Queue

Failed jobs that exceed max retries should be monitored via the DLQ monitoring system (see `packages/process-lib/src/bullmq/dlq-monitor.ts`). Critical scheduled job failures should trigger alerts via the monitoring infrastructure.

## Cron Schedule Summary

| Time | Service | Job | Frequency |
|---|---|---|---|
| `0 * * * *` | analytics-aggregator | Hourly event aggregation | Hourly |
| `0 * * * *` | journey-executor | Segment trigger evaluation | Hourly |
| `0 0 * * *` | analytics-aggregator | Warmup daily send counter reset | Daily (midnight) |
| `0 2 * * *` | analytics-aggregator | Daily report generation | Daily (2 AM) |
| `0 3 * * *` | journey-executor | Stale execution cleanup | Daily (3 AM) |
| `0 3 1 * *` | analytics-aggregator | Monthly usage summary | Monthly (1st, 3 AM) |

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
