import type { ScheduledEvent } from '@cloudflare/workers-types';
import { queue as queueHandler, scheduled as scheduledHandler } from './queue-worker.js';
import type { AnalyticsQueueEnv } from './queue-worker.js';

export default {
  async queue(batch: MessageBatch, env: AnalyticsQueueEnv, _ctx: ExecutionContext) {
    await queueHandler(batch, env);
  },
  async scheduled(event: ScheduledEvent, env: AnalyticsQueueEnv, _ctx: ExecutionContext) {
    await scheduledHandler(event, env);
  },
};
