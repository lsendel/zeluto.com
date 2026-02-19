import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index.js';

export interface SessionUser {
  id: string; // UUID
  email: string;
  name: string;
}

export interface SessionOrganization {
  id: string; // UUID
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}

export interface SessionData {
  user: SessionUser;
  organization?: SessionOrganization;
}

/**
 * Auth middleware - validates session via Identity Worker
 * Calls IDENTITY service binding to validate session cookie/token
 * Sets user + organization data in context
 *
 * On expired/invalid session: redirect to login (HTML) or 401 (API)
 * On missing organization: redirect to onboarding (HTML) or set user without org (API)
 */
const PUBLIC_PATHS = new Set(['/login', '/signup', '/health']);
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/v1/billing/webhooks/stripe',
  '/public/',
  '/app/signup',
];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isApiRequest(path: string): boolean {
  return path.startsWith('/api/');
}

export function authMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;

    // Skip auth for explicitly public routes (signup, auth callbacks, etc.)
    if (isPublicPath(path)) {
      return next();
    }

    try {
      // Forward request to Identity Worker to validate session
      let identityResponse = await fetchIdentitySessionViaDispatch(c);
      if (!identityResponse) {
        identityResponse = await c.env.IDENTITY.fetch(
          new Request('https://internal/api/auth/session', {
            headers: c.req.raw.headers,
          }),
        );
      }

      if (!identityResponse.ok) {
        // Check if the user is authenticated but has no active organization
        const errorBody = await identityResponse.json().catch(() => null) as { error?: string } | null;

        if (identityResponse.status === 400 && errorBody?.error === 'NO_ACTIVE_ORGANIZATION') {
          // User is authenticated but needs onboarding — allow through for specific paths
          if (
            path.startsWith('/app/onboarding') ||
            path.startsWith('/api/v1/onboarding') ||
            path.startsWith('/api/v1/identity')
          ) {
            return next();
          }
          if (isApiRequest(path)) {
            return c.json(
              {
                error: 'NO_ORGANIZATION',
                message: 'No active organization. Complete onboarding first.',
                redirect: '/app/onboarding/org',
              },
              412,
            );
          }
          return c.redirect('/app/onboarding/org');
        }

        // 401 = session expired or invalid
        if (isApiRequest(path)) {
          return c.json(
            { error: 'UNAUTHORIZED', message: 'Session expired or invalid' },
            401,
          );
        }
        return c.redirect('/login');
      }

      const sessionData = (await identityResponse.json()) as SessionData;

      // Set user data in context
      c.set('user', sessionData.user);
      c.set('userId', sessionData.user.id);

      // Handle missing organization
      if (sessionData.organization) {
        c.set('organization', sessionData.organization);
        c.set('organizationId', sessionData.organization.id);
      } else {
        // User has no active organization - redirect to onboarding for HTML requests
        // For onboarding paths, allow through without org
        if (
          path.startsWith('/app/onboarding') ||
          path.startsWith('/api/v1/onboarding') ||
          path.startsWith('/api/v1/identity')
        ) {
          // Allow through - onboarding and identity routes work without org
        } else if (isApiRequest(path)) {
          return c.json(
            {
              error: 'NO_ORGANIZATION',
              message: 'No active organization. Complete onboarding first.',
              redirect: '/app/onboarding/org',
            },
            412,
          );
        } else {
          return c.redirect('/app/onboarding/org');
        }
      }

      await next();
    } catch (error) {
      c.get('logger')?.error({ error: String(error) }, 'Auth middleware error');

      if (isApiRequest(path)) {
        return c.json({ error: 'INTERNAL_ERROR' }, 500);
      }
      return c.redirect('/login');
    }
  };
}

async function fetchIdentitySessionViaDispatch(c: any): Promise<Response | null> {
  const dispatch = c.env.IDENTITY_DISPATCH;
  if (!dispatch) {
    return null;
  }

  const forwardedHeaders: Array<[string, string]> = [];
  c.req.raw.headers.forEach((value: string, key: string) => {
    forwardedHeaders.push([key, value]);
  });

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const requestId = c.get('requestId');
  if (requestId) {
    requestHeaders['X-Request-Id'] = requestId;
  }

  try {
    return await dispatch.fetch(
      'https://identity.internal/__dispatch/identity/session/validate',
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ headers: forwardedHeaders }),
      },
    );
  } catch (error) {
    c.get('logger')?.warn(
      { error: String(error) },
      'Identity dispatch session validation failed, falling back to HTTP',
    );
    return null;
  }
}
