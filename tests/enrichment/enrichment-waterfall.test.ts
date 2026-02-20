import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Enrichment Waterfall', () => {
  const mockProviderA = {
    name: 'clearbit' as const,
    enrich: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  };

  const mockProviderB = {
    name: 'apollo' as const,
    enrich: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  };

  const mockCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockProviderA.enrich.mockResolvedValue({});
    mockProviderA.healthCheck.mockResolvedValue(true);
    mockProviderB.enrich.mockResolvedValue({});
    mockProviderB.healthCheck.mockResolvedValue(true);
    mockCache.get.mockResolvedValue(null);
  });

  it('should enrich with first provider on success', async () => {
    mockProviderA.enrich.mockResolvedValue({
      email: 'john@acme.com',
      company: 'Acme Corp',
      confidence: 0.95,
    });

    const result = await enrichWithWaterfall(
      [mockProviderA, mockProviderB],
      { contactId: 'c1', fields: ['email', 'company'] },
      mockCache,
    );

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('john@acme.com');
    expect(mockProviderA.enrich).toHaveBeenCalledTimes(1);
    expect(mockProviderB.enrich).not.toHaveBeenCalled();
  });

  it('should fallback to second provider when first fails', async () => {
    mockProviderA.enrich.mockRejectedValue(new Error('API error'));
    mockProviderB.enrich.mockResolvedValue({
      email: 'john@acme.com',
      confidence: 0.8,
    });

    const result = await enrichWithWaterfall(
      [mockProviderA, mockProviderB],
      { contactId: 'c1', fields: ['email'] },
      mockCache,
    );

    expect(result.success).toBe(true);
    expect(mockProviderA.enrich).toHaveBeenCalledTimes(1);
    expect(mockProviderB.enrich).toHaveBeenCalledTimes(1);
  });

  it('should return cache hit without calling providers', async () => {
    mockCache.get.mockResolvedValue({
      email: 'cached@acme.com',
      company: 'Acme Corp',
    });

    const result = await enrichWithWaterfall(
      [mockProviderA],
      { contactId: 'c1', fields: ['email'] },
      mockCache,
    );

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('cached@acme.com');
    expect(mockProviderA.enrich).not.toHaveBeenCalled();
  });

  it('should fail when all providers fail', async () => {
    mockProviderA.enrich.mockRejectedValue(new Error('A failed'));
    mockProviderB.enrich.mockRejectedValue(new Error('B failed'));

    const result = await enrichWithWaterfall(
      [mockProviderA, mockProviderB],
      { contactId: 'c1', fields: ['email'] },
      mockCache,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should process batch enrichment for multiple contacts', async () => {
    mockProviderA.enrich.mockResolvedValue({
      email: 'test@example.com',
      confidence: 0.9,
    });

    const contacts = ['c1', 'c2', 'c3'];
    const results = await Promise.all(
      contacts.map((contactId) =>
        enrichWithWaterfall(
          [mockProviderA],
          { contactId, fields: ['email'] },
          mockCache,
        ),
      ),
    );

    expect(results.every((r) => r.success)).toBe(true);
    expect(mockProviderA.enrich).toHaveBeenCalledTimes(3);
  });
});

// Simplified waterfall implementation for testing
async function enrichWithWaterfall(
  providers: Array<{ name: string; enrich: Function }>,
  request: { contactId: string; fields: string[] },
  cache: { get: Function; set: Function },
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  // Check cache
  const cached = await cache.get(request.contactId);
  if (cached) return { success: true, data: cached };

  // Try providers in order
  for (const provider of providers) {
    try {
      const data = await provider.enrich(request);
      await cache.set(request.contactId, data);
      return { success: true, data };
    } catch {}
  }

  return { success: false, error: 'All providers failed' };
}
