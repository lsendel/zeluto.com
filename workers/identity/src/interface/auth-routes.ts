import { Hono } from 'hono';
import type { Env } from '../infrastructure/database.js';
import { createDatabase } from '../infrastructure/database.js';
import { createAuth } from '../infrastructure/better-auth.js';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * Better Auth handler - delegates all /api/auth/* requests to Better Auth
 */
authRoutes.all('/api/auth/*', async (c) => {
  const db = createDatabase(c.env);
  const auth = createAuth(c.env, db);

  // Better Auth handles the request and returns a Response
  return auth.handler(c.req.raw);
});

/**
 * Internal session validation endpoint for Gateway service binding
 * This allows the gateway to validate sessions without exposing Better Auth internals
 */
authRoutes.post('/internal/validate-session', async (c) => {
  const db = createDatabase(c.env);
  const auth = createAuth(c.env, db);

  const { token } = await c.req.json<{ token: string }>();

  try {
    const session = await auth.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    });

    if (!session) {
      return c.json({ valid: false }, 401);
    }

    return c.json({
      valid: true,
      session,
    });
  } catch (error) {
    return c.json({ valid: false, error: 'Invalid session' }, 401);
  }
});

export default authRoutes;
