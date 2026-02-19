import { queue as queueHandler } from './queue-worker.js';
import type { CampaignQueueEnv } from './events/index.js';

export default {
  async queue(batch: MessageBatch, env: CampaignQueueEnv, _ctx: ExecutionContext) {
    await queueHandler(batch, env);
  },
};
