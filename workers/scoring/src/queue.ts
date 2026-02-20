import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { ScoringQueueEnv } from './queue/queue-handler.js';
import { handleScoringQueue } from './queue/queue-handler.js';
import { handleScheduled } from './queue/scheduler.js';

export default {
  async queue(
    batch: MessageBatch,
    env: ScoringQueueEnv,
    _ctx: ExecutionContext,
  ) {
    await handleScoringQueue(batch, env);
  },
  async scheduled(
    event: ScheduledEvent,
    env: ScoringQueueEnv & { ENABLE_SCORING_CRON?: string },
    _ctx: ExecutionContext,
  ) {
    await handleScheduled(event, env);
  },
};
