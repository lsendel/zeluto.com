import { describe, it, expect, vi } from 'vitest';
import { parsePayload, parseJsonBody } from './parse-payload.js';

function createMockContext(contentType: string, body: unknown) {
  return {
    req: {
      header: (name: string) => name === 'Content-Type' ? contentType : undefined,
      json: vi.fn().mockResolvedValue(body),
      parseBody: vi.fn().mockResolvedValue(body),
      raw: { clone: () => ({ json: () => Promise.resolve(body) }) },
    },
  };
}

describe('parsePayload', () => {
  it('extracts string fields from JSON body', async () => {
    const c = createMockContext('application/json', { name: 'Acme', slug: 'acme', extra: 123 });
    const result = await parsePayload(c as any, ['name', 'slug']);
    expect(result).toEqual({ name: 'Acme', slug: 'acme' });
  });

  it('extracts string fields from form data', async () => {
    const c = createMockContext('application/x-www-form-urlencoded', { name: 'Acme', slug: 'acme' });
    const result = await parsePayload(c as any, ['name', 'slug']);
    expect(result).toEqual({ name: 'Acme', slug: 'acme' });
  });

  it('skips non-string fields', async () => {
    const c = createMockContext('application/json', { name: 123, slug: null });
    const result = await parsePayload(c as any, ['name', 'slug']);
    expect(result).toEqual({});
  });

  it('handles JSON parse errors gracefully', async () => {
    const c = {
      req: {
        header: () => 'application/json',
        json: vi.fn().mockRejectedValue(new Error('bad json')),
        parseBody: vi.fn(),
      },
    };
    const result = await parsePayload(c as any, ['name']);
    expect(result).toEqual({});
  });
});

describe('parseJsonBody', () => {
  it('returns parsed JSON body', async () => {
    const c = createMockContext('application/json', { foo: 'bar' });
    const result = await parseJsonBody(c as any);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns null on parse error', async () => {
    const c = {
      req: {
        raw: { clone: () => ({ json: () => Promise.reject(new Error('bad')) }) },
      },
    };
    const result = await parseJsonBody(c as any);
    expect(result).toBeNull();
  });
});
