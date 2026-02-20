import { describe, expect, it, vi } from 'vitest';
import { ProviderConfig } from '../entities/provider-config.js';
import type { SuppressionEntry } from '../entities/suppression-entry.js';
import type { SuppressionRepository } from '../repositories/suppression-repository.js';
import { DeliveryPipeline } from './delivery-pipeline.js';
import type { ProviderResolver } from './provider-resolver.js';

function createProviderConfig(input: {
  channel: 'email' | 'sms' | 'push' | 'webhook';
  providerType:
    | 'ses'
    | 'sendgrid'
    | 'twilio'
    | 'postmark'
    | 'custom_smtp'
    | 'fcm';
  priority: number;
}): ProviderConfig {
  return ProviderConfig.create({
    organizationId: crypto.randomUUID(),
    channel: input.channel,
    providerType: input.providerType,
    config: {},
    priority: input.priority,
  });
}

function createResolver(configs: ProviderConfig[]): ProviderResolver {
  return {
    async resolve() {
      return configs[0] ?? null;
    },
    async resolveAll() {
      return configs;
    },
  } as unknown as ProviderResolver;
}

function createSuppressionRepo(isBlocked: boolean): SuppressionRepository {
  return {
    async findById(): Promise<SuppressionEntry | null> {
      return null;
    },
    async isBlocked(): Promise<boolean> {
      return isBlocked;
    },
    async findByOrganization() {
      return { data: [], total: 0 };
    },
    async save() {
      return;
    },
    async delete() {
      return;
    },
  };
}

describe('DeliveryPipeline', () => {
  it('falls back to the next provider when highest-priority provider fails', async () => {
    const primary = createProviderConfig({
      channel: 'email',
      providerType: 'sendgrid',
      priority: 100,
    });
    const fallback = createProviderConfig({
      channel: 'email',
      providerType: 'ses',
      priority: 90,
    });

    const createProvider = vi
      .fn()
      .mockImplementationOnce(() => ({
        channel: 'email' as const,
        name: 'sendgrid',
        send: vi.fn().mockResolvedValue({
          success: false,
          error: 'primary failed',
        }),
      }))
      .mockImplementationOnce(() => ({
        channel: 'email' as const,
        name: 'ses',
        send: vi.fn().mockResolvedValue({
          success: true,
          externalId: 'fallback-message-id',
        }),
      }));

    const pipeline = new DeliveryPipeline({
      suppressionRepo: createSuppressionRepo(false),
      providerResolver: createResolver([primary, fallback]),
      createProvider,
    });

    const result = await pipeline.execute({
      organizationId: crypto.randomUUID(),
      channel: 'email',
      recipient: 'test@example.com',
      from: 'no-reply@example.com',
      subject: 'Subject',
      body: '<p>Hello</p>',
    });

    expect(result).toEqual({
      success: true,
      messageId: 'fallback-message-id',
    });
    expect(createProvider).toHaveBeenCalledTimes(2);
  });

  it('returns combined failure when all providers fail', async () => {
    const p1 = createProviderConfig({
      channel: 'email',
      providerType: 'sendgrid',
      priority: 100,
    });
    const p2 = createProviderConfig({
      channel: 'email',
      providerType: 'ses',
      priority: 90,
    });

    const pipeline = new DeliveryPipeline({
      suppressionRepo: createSuppressionRepo(false),
      providerResolver: createResolver([p1, p2]),
      createProvider: (providerConfig) => ({
        channel: 'email',
        name: providerConfig.providerType,
        async send() {
          return { success: false, error: 'send failed' };
        },
      }),
    });

    const result = await pipeline.execute({
      organizationId: crypto.randomUUID(),
      channel: 'email',
      recipient: 'test@example.com',
      from: 'no-reply@example.com',
      subject: 'Subject',
      body: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('All providers failed');
    expect(result.error).toContain('sendgrid');
    expect(result.error).toContain('ses');
  });

  it('short-circuits when recipient is suppressed', async () => {
    const provider = createProviderConfig({
      channel: 'email',
      providerType: 'sendgrid',
      priority: 100,
    });

    const createProvider = vi.fn();
    const pipeline = new DeliveryPipeline({
      suppressionRepo: createSuppressionRepo(true),
      providerResolver: createResolver([provider]),
      createProvider,
    });

    const result = await pipeline.execute({
      organizationId: crypto.randomUUID(),
      channel: 'email',
      recipient: 'blocked@example.com',
      from: 'no-reply@example.com',
      subject: 'Subject',
      body: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('suppressed');
    expect(createProvider).not.toHaveBeenCalled();
  });
});
