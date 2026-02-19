import type { EnrichmentProviderAdapter, EnrichmentRequest } from './enrichment-provider-adapter.js';
import type { EnrichmentCacheRepository } from '../repositories/enrichment-cache-repository.js';
import type { ProviderHealthRepository } from '../repositories/provider-health-repository.js';
import type { WaterfallConfigRepository } from '../repositories/waterfall-config-repository.js';
import type { EnrichmentJob } from '../entities/enrichment-job.js';
import { ProviderHealth } from '../entities/provider-health.js';

export interface EnrichmentOrchestratorDeps {
  adapters: Map<string, EnrichmentProviderAdapter>;
  cache: EnrichmentCacheRepository;
  health: ProviderHealthRepository;
  waterfallConfig: WaterfallConfigRepository;
}

export class EnrichmentOrchestrator {
  constructor(private readonly deps: EnrichmentOrchestratorDeps) {}

  async execute(organizationId: string, job: EnrichmentJob, contactData: EnrichmentRequest): Promise<void> {
    job.start();

    for (const field of job.fieldRequests) {
      // Check cache first
      const cached = await this.deps.cache.get(organizationId, job.contactId, field);
      if (cached && cached.expiresAt > new Date()) {
        job.addResult({
          field,
          provider: cached.providerId,
          value: cached.value,
          confidence: cached.confidence,
          cost: 0,
          latencyMs: 0,
        });
        continue;
      }

      // Get waterfall config for this field
      const config = await this.deps.waterfallConfig.findByField(organizationId, field);
      if (!config) continue;

      let enriched = false;

      for (const providerId of config.providerOrder) {
        if (job.providersTried.length >= config.maxAttempts) break;

        // Check cost guard
        if (config.maxCostPerLead != null && job.totalCost >= config.maxCostPerLead) break;

        // Check circuit breaker
        let health = await this.deps.health.findByProvider(organizationId, providerId);
        if (!health) {
          health = ProviderHealth.create(organizationId, providerId);
        }
        if (!health.isAvailable()) continue;

        const adapter = this.deps.adapters.get(providerId);
        if (!adapter) continue;

        try {
          const result = await adapter.enrich(contactData);

          if (result.success) {
            const fieldResult = result.fields.find(f => f.field === field);
            if (fieldResult && fieldResult.confidence >= config.minConfidence) {
              job.addResult({
                field,
                provider: providerId,
                value: fieldResult.value,
                confidence: fieldResult.confidence,
                cost: result.cost,
                latencyMs: result.latencyMs,
              });

              // Update cache
              await this.deps.cache.set(organizationId, {
                contactId: job.contactId,
                fieldName: field,
                providerId,
                value: fieldResult.value,
                confidence: fieldResult.confidence,
                expiresAt: new Date(Date.now() + config.cacheTtlDays * 24 * 60 * 60 * 1000),
              });

              health.recordSuccess();
              await this.deps.health.save(health);
              enriched = true;
              break;
            }
          }

          health.recordSuccess();
          await this.deps.health.save(health);
        } catch {
          health.recordFailure();
          await this.deps.health.save(health);
        }
      }

      if (!enriched && !job.results.find(r => r.field === field)) {
        // Field exhausted all providers — no action needed, tracked by job state
      }
    }

    const allFieldsAttempted = job.fieldRequests.every(
      f => job.results.some(r => r.field === f),
    );

    if (allFieldsAttempted) {
      job.complete();
    } else {
      job.exhaust();
    }
  }
}
