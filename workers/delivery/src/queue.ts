import { queue as queueHandler } from './queue-worker.js';
import type { DeliveryQueueEnv } from './queue-worker.js';

export default {
  async queue(batch: MessageBatch, env: DeliveryQueueEnv, _ctx: ExecutionContext) {
    await queueHandler(batch, env);
  },
};
