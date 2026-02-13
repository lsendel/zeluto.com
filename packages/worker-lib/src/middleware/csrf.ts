import type { MiddlewareHandler } from 'hono';

export function csrfMiddleware(kv: KVNamespace): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

    if (c.req.header('Authorization')?.startsWith('Bearer ')) return next();

    const token = c.req.header('X-CSRF-Token');
    const sessionId = c.get('sessionId');

    if (!token || !sessionId)
      return c.json({ error: 'CSRF_TOKEN_REQUIRED' }, 403);

    const stored = await kv.get(`csrf:${sessionId}`);
    if (stored !== token)
      return c.json({ error: 'CSRF_TOKEN_INVALID' }, 403);

    await next();
  };
}
