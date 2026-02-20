import type { Env } from './app.js';
import { handleJourneyQueue } from './events/index.js';

export default {
  async queue(
    batch: MessageBatch,
    env: Env['Bindings'],
    _ctx: ExecutionContext,
  ) {
    await handleJourneyQueue(batch, env);
  },
};
