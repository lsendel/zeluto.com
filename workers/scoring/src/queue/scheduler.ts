import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { ScoringJobType, ScoringQueueEnv } from './queue-handler.js';

const CRON_TO_JOBS: Record<string, ScoringJobType[]> = {
  '0 * * * *': ['scoring.BatchRecompute', 'scoring.SignalDecay'],
  '*/15 * * * *': ['scoring.AlertExpiry'],
};

export async function handleScheduled(
  event: ScheduledEvent,
  env: ScoringQueueEnv & {
    ENABLE_SCORING_CRON?: string;
  },
): Promise<void> {
  if (env.ENABLE_SCORING_CRON && env.ENABLE_SCORING_CRON !== 'true') {
    return;
  }

  const jobs = CRON_TO_JOBS[event.cron] ?? [];
  if (!jobs.length) {
    return;
  }

  if (!env.EVENTS) {
    console.warn(
      'No scoring queue binding available for scheduled job dispatch',
    );
    return;
  }

  const scheduledFor = new Date(
    event.scheduledTime ?? Date.now(),
  ).toISOString();

  const messages = jobs.map((type) => ({
    body: { type, scheduledFor },
  }));

  await env.EVENTS.sendBatch(messages as any);
}
