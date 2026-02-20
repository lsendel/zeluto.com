import { createDatabase } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import app from './app.js';
import { drainCrmOutbox } from './events/outbox-publisher.js';

export default {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: { DATABASE_URL: string; EVENTS: Queue },
    _ctx: ExecutionContext,
  ) {
    const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
    const drained = await drainCrmOutbox(db, env.EVENTS);
    if (drained > 0) {
      console.log(`Outbox drain: published ${drained} events`);
    }
  },
};
