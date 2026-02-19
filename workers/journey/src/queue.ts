import { handleJourneyQueue } from './events/index.js';
import type { Env } from './app.js';

export default {
  async queue(batch: MessageBatch, env: Env, _ctx: ExecutionContext) {
    await handleJourneyQueue(batch, env);
  },
};
