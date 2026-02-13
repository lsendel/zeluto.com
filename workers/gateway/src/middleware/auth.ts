import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index.js';

export interface SessionData {
  user: {
    id: string; // UUID
    email: string;
    name: string;
  };
  organization: {
    id: string; // UUID
    name: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    plan: 'free' | 'starter' | 'pro' | 'enterprise';
  };
}

/**
 * Auth middleware - validates session via Identity Worker
 * Calls IDENTITY service binding to validate session cookie/token
 * Sets user + organization data in context
 */
export function authMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;

    // Skip auth for public routes
    if (
      path.startsWith('/api/auth/') ||
      path === '/login' ||
      path === '/signup' ||
      path === '/health' ||
      path.startsWith('/public/')
    ) {
      return next();
    }

    try {
      // Forward request to Identity Worker to validate session
      const identityResponse = await c.env.IDENTITY.fetch(
        new Request('https://internal/api/auth/session', {
          headers: c.req.raw.headers,
        }),
      );

      if (!identityResponse.ok) {
        // Session invalid - redirect to login for HTML, 401 for API
        if (path.startsWith('/api/')) {
          return c.json({ error: 'UNAUTHORIZED' }, 401);
        }
        return c.redirect('/login');
      }

      const sessionData = (await identityResponse.json()) as SessionData;

      // Set session data in context for downstream middleware/handlers
      c.set('user', sessionData.user);
      c.set('organization', sessionData.organization);
      c.set('userId', sessionData.user.id);
      c.set('organizationId', sessionData.organization.id);

      await next();
    } catch (error) {
      c.get('logger')?.error({ error }, 'Auth middleware error');
      return c.json({ error: 'INTERNAL_ERROR' }, 500);
    }
  };
}
