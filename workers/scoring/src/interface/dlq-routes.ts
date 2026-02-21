import { Hono } from 'hono';
import type { Env } from '../app.js';

export interface DlqEntry {
  id: string;
  type: string;
  payload: unknown;
  error: string;
  attempts: number;
  failedAt: string;
}

export const dlqRoutes = new Hono<Env>();

// GET /api/v1/scoring/dlq — list dead-letter entries
dlqRoutes.get('/api/v1/scoring/dlq', async (c) => {
  const kv = c.env.KV;
  const cursor = c.req.query('cursor') ?? undefined;
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);

  const list = await kv.list({ prefix: 'dlq:', limit, cursor });
  const entries: DlqEntry[] = [];

  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (raw) {
      entries.push(JSON.parse(raw) as DlqEntry);
    }
  }

  return c.json({
    entries,
    cursor: list.list_complete ? null : list.cursor,
  });
});

// POST /api/v1/scoring/dlq/:id/replay — re-enqueue a DLQ message
dlqRoutes.post('/api/v1/scoring/dlq/:id/replay', async (c) => {
  const { id } = c.req.param();
  const kv = c.env.KV;
  const raw = await kv.get(`dlq:${id}`);

  if (!raw) {
    return c.json({ error: 'DLQ entry not found' }, 404);
  }

  const entry = JSON.parse(raw) as DlqEntry;
  await c.env.EVENTS.send(entry.payload);
  await kv.delete(`dlq:${id}`);

  return c.json({ message: 'Message replayed', id });
});

// DELETE /api/v1/scoring/dlq/:id — discard a DLQ message
dlqRoutes.delete('/api/v1/scoring/dlq/:id', async (c) => {
  const { id } = c.req.param();
  const kv = c.env.KV;
  const raw = await kv.get(`dlq:${id}`);

  if (!raw) {
    return c.json({ error: 'DLQ entry not found' }, 404);
  }

  await kv.delete(`dlq:${id}`);
  return c.json({ message: 'DLQ entry discarded', id });
});
