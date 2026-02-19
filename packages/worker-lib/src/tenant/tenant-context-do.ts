import type { TenantContext } from '@mauntic/domain-kernel/tenant';

type StoredContext = {
  context: TenantContext;
  expiresAt: number;
};

type StoredState<T = unknown> = {
  value: T;
  expiresAt: number | null;
};

const CONTEXT_KEY = 'context';
const STATE_PREFIX = 'state:';

export class TenantContextDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      return this.handleState(request, url);
    }
    return this.handleContext(request);
  }

  private async handleContext(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();

    if (method === 'PUT') {
      const body = (await request.json()) as { context: TenantContext; ttl?: number };
      const ttlSeconds = Math.max(60, Math.min(body.ttl ?? 300, 3600));
      const expiresAt = Date.now() + ttlSeconds * 1000;
      const record: StoredContext = {
        context: body.context,
        expiresAt,
      };
      await this.state.storage.put(CONTEXT_KEY, record);
      return new Response(null, { status: 204 });
    }

    if (method === 'DELETE') {
      await this.state.storage.delete(CONTEXT_KEY);
      return new Response(null, { status: 204 });
    }

    if (method === 'GET') {
      const record = (await this.state.storage.get<StoredContext>(CONTEXT_KEY)) ?? null;
      if (!record) {
        return new Response(null, { status: 404 });
      }

      if (record.expiresAt <= Date.now()) {
        await this.state.storage.delete(CONTEXT_KEY);
        return new Response(null, { status: 404 });
      }

      return Response.json(record.context);
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  private async handleState(request: Request, url: URL): Promise<Response> {
    const method = request.method.toUpperCase();

    if (method === 'PUT') {
      const body = (await request.json()) as { key: string; value: unknown; ttl?: number };
      if (!body.key) {
        return new Response('Missing key', { status: 400 });
      }
      const ttlSeconds = body.ttl ? Math.max(30, Math.min(body.ttl, 86400)) : null;
      const record: StoredState = {
        value: body.value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      };
      await this.state.storage.put(STATE_PREFIX + body.key, record);
      return new Response(null, { status: 204 });
    }

    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    const storageKey = STATE_PREFIX + key;

    if (method === 'DELETE') {
      await this.state.storage.delete(storageKey);
      return new Response(null, { status: 204 });
    }

    if (method === 'GET') {
      const record = (await this.state.storage.get<StoredState>(storageKey)) ?? null;
      if (!record) {
        return new Response(null, { status: 404 });
      }
      if (record.expiresAt && record.expiresAt <= Date.now()) {
        await this.state.storage.delete(storageKey);
        return new Response(null, { status: 404 });
      }
      return Response.json(record.value);
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
}

async function callTenantDO<T>(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  if (!namespace) return null;
  const id = namespace.idFromName(cacheKey);
  const stub = namespace.get(id);
  try {
    return await stub.fetch(`https://tenant-context${path}`, init);
  } catch (error) {
    console.warn('Tenant context DO request failed:', error);
    return null;
  }
}

export async function cacheTenantContext(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
  context: TenantContext,
  ttlSeconds = 300,
): Promise<void> {
  await callTenantDO(namespace, cacheKey, '/', {
    method: 'PUT',
    body: JSON.stringify({ context, ttl: ttlSeconds }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function fetchTenantContext(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
): Promise<TenantContext | null> {
  const response = await callTenantDO(namespace, cacheKey, '/');
  if (!response || response.status !== 200) {
    return null;
  }
  return (await response.json()) as TenantContext;
}

export async function cacheTenantState(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<void> {
  await callTenantDO(namespace, cacheKey, '/state', {
    method: 'PUT',
    body: JSON.stringify({ key, value, ttl: ttlSeconds }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function fetchTenantState<T>(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
  key: string,
): Promise<T | null> {
  const response = await callTenantDO(namespace, cacheKey, `/state?key=${encodeURIComponent(key)}`);
  if (!response || response.status !== 200) {
    return null;
  }
  return (await response.json()) as T;
}

export async function deleteTenantState(
  namespace: DurableObjectNamespace | undefined,
  cacheKey: string,
  key: string,
): Promise<void> {
  await callTenantDO(namespace, cacheKey, `/state?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}
