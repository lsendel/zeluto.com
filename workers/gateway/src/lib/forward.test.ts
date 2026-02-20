import { describe, it, expect, vi } from 'vitest';
import { forwardToService } from './forward.js';

function createMockContext(overrides: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  tenantContext?: Record<string, unknown>;
  requestId?: string;
} = {}) {
  const store = new Map<string, unknown>();
  if (overrides.tenantContext) store.set('tenantContext', overrides.tenantContext);
  if (overrides.requestId) store.set('requestId', overrides.requestId);

  const loggerWarn = vi.fn();
  const loggerError = vi.fn();
  store.set('logger', { warn: loggerWarn, error: loggerError });

  return {
    get: (key: string) => store.get(key),
    set: (key: string, val: unknown) => store.set(key, val),
    req: {
      url: overrides.url ?? 'https://zeluto.com/api/v1/crm/contacts',
      method: overrides.method ?? 'GET',
      raw: {
        headers: new Headers(overrides.headers ?? {}),
        body: null,
      },
    },
    json: vi.fn(),
  };
}

describe('forwardToService', () => {
  it('forwards GET request to service binding', async () => {
    const c = createMockContext({ requestId: 'req-1' });
    const mockService = {
      fetch: vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })),
    };

    const result = await forwardToService(c as any, mockService as any);
    expect(result.status).toBe(200);
    expect(mockService.fetch).toHaveBeenCalled();
  });

  it('propagates X-Tenant-Context when tenant is set', async () => {
    const c = createMockContext({
      tenantContext: { organizationId: 'org-1', userId: 'user-1', plan: 'pro', userRole: 'admin' },
    });
    const mockService = {
      fetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    };

    await forwardToService(c as any, mockService as any);
    const headers = mockService.fetch.mock.calls[0][1].headers;
    expect(headers.get('X-Tenant-Context')).toBeDefined();
  });

  it('skips tenant header when skipTenant is true', async () => {
    const c = createMockContext({
      tenantContext: { organizationId: 'org-1' },
    });
    const mockService = {
      fetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    };

    await forwardToService(c as any, mockService as any, { skipTenant: true });
    const headers = mockService.fetch.mock.calls[0][1].headers;
    expect(headers.get('X-Tenant-Context')).toBeNull();
  });

  it('returns 503 on service fetch error', async () => {
    const c = createMockContext();
    const mockService = {
      fetch: vi.fn().mockRejectedValue(new Error('binding down')),
    };

    const result = await forwardToService(c as any, mockService as any);
    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.error).toBe('SERVICE_UNAVAILABLE');
  });
});
