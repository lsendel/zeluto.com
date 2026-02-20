import { Hono } from 'hono';
import { validateSessionFromHeaders } from '../application/session-service.js';
import { createAuth } from '../infrastructure/better-auth.js';
import type { Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * Internal session validation endpoint for Gateway service binding
 * Must be checked BEFORE Better Auth routes to intercept /api/auth/session
 */
authRoutes.get('/api/auth/session', async (c) => {
  const result = await validateSessionFromHeaders(c.env, c.req.raw.headers);
  return c.json(result.body, result.status);
});

/**
 * Better Auth handler - delegates all other /api/auth/* requests to Better Auth
 */
authRoutes.all('/api/auth/*', async (c) => {
  const db = createDatabase(c.env);
  const auth = createAuth(c.env, db);
  return auth.handler(c.req.raw);
});

export default authRoutes;
