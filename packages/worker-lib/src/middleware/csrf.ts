import type { MiddlewareHandler } from 'hono';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection middleware for Hono.
 *
 * - Generates a per-session CSRF token stored in KV
 * - Sets the token in a response cookie (`csrf-token`) for HTMX to read
 * - Also sets `X-CSRF-Token` response header for non-cookie clients
 * - Validates the token on all mutating requests (POST, PUT, PATCH, DELETE)
 * - Skips validation for API key / Bearer token auth (handled by api-key middleware)
 *
 * HTMX integration:
 *   In your HTML layout, include:
 *   <meta name="csrf-token" content="{{token}}" />
 *   <body hx-headers='{"X-CSRF-Token": "{{token}}"}'>
 */
export function csrfMiddleware(kv: KVNamespace): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;

    // Skip CSRF for auth endpoints — Better Auth handles its own CSRF protection
    if (path.startsWith('/api/auth/')) return next();

    // Skip CSRF for API endpoints — session cookie uses SameSite=Lax which
    // prevents cross-origin POST requests, providing equivalent CSRF protection
    if (path.startsWith('/api/')) return next();

    const method = c.req.method;
    const sessionId = c.get('sessionId') as string | undefined;

    // For non-mutating requests, generate/refresh token and continue
    if (!MUTATING_METHODS.has(method)) {
      await next();

      // After next(), set CSRF token in response for the client
      if (sessionId) {
        const token = await getOrCreateToken(kv, sessionId);
        setCsrfCookie(c, token);
        c.header('X-CSRF-Token', token);
      }

      return;
    }

    // Skip CSRF for API key / Bearer auth (these have their own auth)
    if (c.get('apiKeyAuth')) return next();
    if (c.req.header('Authorization')?.startsWith('Bearer ')) return next();

    // Validate CSRF token on mutating requests
    const token =
      c.req.header('X-CSRF-Token') ??
      getCsrfFromCookie(c.req.header('Cookie'));

    if (!token || !sessionId) {
      return c.json({ error: 'CSRF_TOKEN_REQUIRED' }, 403);
    }

    const stored = await kv.get(`csrf:${sessionId}`);
    if (stored !== token) {
      return c.json({ error: 'CSRF_TOKEN_INVALID' }, 403);
    }

    await next();
  };
}

/**
 * Get existing or create new CSRF token for a session.
 * Tokens are stored in KV with a 24h TTL, matching session duration.
 */
async function getOrCreateToken(
  kv: KVNamespace,
  sessionId: string,
): Promise<string> {
  const key = `csrf:${sessionId}`;
  const existing = await kv.get(key);

  if (existing) return existing;

  const token = crypto.randomUUID();
  await kv.put(key, token, { expirationTtl: 86400 }); // 24 hours
  return token;
}

/**
 * Set CSRF token as an HttpOnly=false cookie so HTMX JS can read it.
 * SameSite=Strict provides additional CSRF protection.
 */
function setCsrfCookie(c: { header: (name: string, value: string) => void }, token: string): void {
  c.header(
    'Set-Cookie',
    `csrf-token=${token}; Path=/; SameSite=Strict; Secure`,
  );
}

/**
 * Extract CSRF token from cookie header string.
 */
function getCsrfFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;

  const match = cookieHeader.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match?.[1];
}
