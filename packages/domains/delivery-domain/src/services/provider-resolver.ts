import type { Channel } from '../entities/delivery-job.js';
import type { ProviderConfig } from '../entities/provider-config.js';
import type { ProviderConfigRepository } from '../repositories/provider-config-repository.js';

/**
 * Selects the best provider for a given channel and organization.
 * Resolves active providers sorted by priority (highest first).
 */
export class ProviderResolver {
  constructor(private readonly providerConfigRepo: ProviderConfigRepository) {}

  /**
   * Find the highest-priority active provider config for the given org + channel.
   * Returns null if no active provider is configured.
   */
  async resolve(orgId: string, channel: Channel): Promise<ProviderConfig | null> {
    const configs = await this.providerConfigRepo.findActiveByOrgAndChannel(orgId, channel);

    if (configs.length === 0) {
      return null;
    }

    // Sort by priority descending (highest priority wins)
    const sorted = [...configs].sort((a, b) => b.priority - a.priority);
    return sorted[0];
  }

  /**
   * Find all active providers for a channel, sorted by priority descending.
   * Useful for fallback scenarios.
   */
  async resolveAll(orgId: string, channel: Channel): Promise<ProviderConfig[]> {
    const configs = await this.providerConfigRepo.findActiveByOrgAndChannel(orgId, channel);
    return [...configs].sort((a, b) => b.priority - a.priority);
  }
}
