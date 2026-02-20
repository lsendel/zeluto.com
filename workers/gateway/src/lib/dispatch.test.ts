import { describe, it, expect, vi } from 'vitest';
import { dispatchRequest } from './dispatch.js';

function createMockContext(overrides: {
  tenantContext?: Record<string, unknown>;
  tenantContextCacheKey?: string;
  requestId?: string;
} = {}) {
  const store = new Map<string, unknown>();
  if ('tenantContext' in overrides) {
    if (overrides.tenantContext !== undefined) {
      store.set('tenantContext', overrides.tenantContext);
    }
  } else {
    store.set('tenantContext', {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'admin',
      plan: 'pro',
    });
  }
  if (overrides.tenantContextCacheKey) {
    store.set('tenantContextCacheKey', overrides.tenantContextCacheKey);
  }
  if (overrides.requestId) {
    store.set('requestId', overrides.requestId);
  }
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  };
}

describe('dispatchRequest', () => {
  it('returns null when dispatch binding is undefined', async () => {
    const c = createMockContext();
    const result = await dispatchRequest(c as any, {
      dispatch: undefined,
      http: {} as any,
      serviceName: 'identity',
    }, 'users/list', { page: 1 });
    expect(result).toBeNull();
  });

  it('returns null when tenant context is missing and skipTenant is false', async () => {
    const c = createMockContext({ tenantContext: undefined });
    const mockDispatch = { fetch: vi.fn() };
    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any,
      http: {} as any,
      serviceName: 'identity',
    }, 'users/list', { page: 1 });
    expect(result).toBeNull();
    expect(mockDispatch.fetch).not.toHaveBeenCalled();
  });

  it('calls dispatch with correct URL and headers', async () => {
    const c = createMockContext({ requestId: 'req-123' });
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const mockDispatch = { fetch: vi.fn().mockResolvedValue(mockResponse) };

    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any,
      http: {} as any,
      serviceName: 'identity',
    }, 'users/list', { page: 1 });

    expect(result).not.toBeNull();
    expect(mockDispatch.fetch).toHaveBeenCalledWith(
      'https://identity.internal/__dispatch/identity/users/list',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ page: 1 }),
      }),
    );

    const callArgs = mockDispatch.fetch.mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Request-Id']).toBe('req-123');
    expect(headers['X-Tenant-Context']).toBeDefined();
  });

  it('skips tenant header when skipTenant is true', async () => {
    const c = createMockContext({ tenantContext: undefined });
    const mockResponse = new Response('{}', { status: 200 });
    const mockDispatch = { fetch: vi.fn().mockResolvedValue(mockResponse) };

    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any,
      http: {} as any,
      serviceName: 'identity',
    }, 'session/validate', {}, { skipTenant: true });

    expect(result).not.toBeNull();
    const callHeaders = mockDispatch.fetch.mock.calls[0][1].headers;
    expect(callHeaders['X-Tenant-Context']).toBeUndefined();
  });

  it('returns null on dispatch fetch error (fallback path)', async () => {
    const c = createMockContext();
    const mockDispatch = { fetch: vi.fn().mockRejectedValue(new Error('network')) };

    const result = await dispatchRequest(c as any, {
      dispatch: mockDispatch as any,
      http: {} as any,
      serviceName: 'identity',
    }, 'users/list', {});
    expect(result).toBeNull();
  });
});
