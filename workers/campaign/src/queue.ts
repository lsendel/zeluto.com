import type { CampaignQueueEnv } from './events/index.js';
import { queue as queueHandler } from './queue-worker.js';

export default {
  async queue(
    batch: MessageBatch,
    env: CampaignQueueEnv,
    _ctx: ExecutionContext,
  ) {
    await queueHandler(batch, env);
  },
};
