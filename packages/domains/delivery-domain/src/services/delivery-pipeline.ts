import type { DeliveryProvider, DeliveryResult } from '@mauntic/domain-kernel';
import type { Channel } from '../entities/delivery-job.js';
import type { SuppressionRepository } from '../repositories/suppression-repository.js';
import type { ProviderResolver } from './provider-resolver.js';
import type { ProviderConfig } from '../entities/provider-config.js';

export interface DeliveryPipelineResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DeliveryPipelineDeps {
  suppressionRepo: SuppressionRepository;
  providerResolver: ProviderResolver;
  /** Factory that creates the actual provider adapter from config. */
  createProvider: (config: ProviderConfig) => DeliveryProvider<Channel>;
}

export interface DeliveryPipelineInput {
  organizationId: string;
  channel: Channel;
  recipient: string;
  from: string;
  subject?: string;
  body: string;
  text?: string;
}

/**
 * Core delivery pipeline (pure domain logic).
 *
 * Steps:
 * 1. Check suppression list
 * 2. Resolve provider
 * 3. Send via provider
 * 4. Return result
 */
export class DeliveryPipeline {
  constructor(private readonly deps: DeliveryPipelineDeps) {}

  async execute(input: DeliveryPipelineInput): Promise<DeliveryPipelineResult> {
    // Step 1: Check suppression list (email and SMS — push uses FCM token revocation)
    if (input.channel === 'email' || input.channel === 'sms') {
      const isBlocked = await this.deps.suppressionRepo.isBlocked(
        input.organizationId,
        input.recipient,
      );
      if (isBlocked) {
        return {
          success: false,
          error: `Recipient ${input.recipient} is suppressed`,
        };
      }
    }

    // Step 2: Resolve provider
    const providerConfig = await this.deps.providerResolver.resolve(
      input.organizationId,
      input.channel,
    );

    if (!providerConfig) {
      return {
        success: false,
        error: `No active provider configured for channel "${input.channel}"`,
      };
    }

    // Step 3: Build channel-specific payload and send
    const provider = this.deps.createProvider(providerConfig);
    let result: DeliveryResult;

    try {
      result = await this.sendViaProvider(provider, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown send error';
      return { success: false, error: message };
    }

    // Step 4: Return result
    return {
      success: result.success,
      messageId: result.externalId,
      error: result.error,
    };
  }

  private async sendViaProvider(
    provider: DeliveryProvider<Channel>,
    input: DeliveryPipelineInput,
  ): Promise<DeliveryResult> {
    switch (input.channel) {
      case 'email':
        return (provider as DeliveryProvider<'email'>).send({
          to: input.recipient,
          from: input.from,
          subject: input.subject ?? '',
          html: input.body,
          text: input.text,
        });

      case 'sms':
        return (provider as DeliveryProvider<'sms'>).send({
          to: input.recipient,
          from: input.from,
          body: input.body,
        });

      case 'push':
        return (provider as DeliveryProvider<'push'>).send({
          deviceToken: input.recipient,
          title: input.subject ?? '',
          body: input.body,
        });

      case 'webhook':
        return (provider as DeliveryProvider<'webhook'>).send({
          url: input.recipient,
          method: 'POST',
          body: input.body,
        });

      default:
        return { success: false, error: `Unsupported channel: ${input.channel as string}` };
    }
  }
}
