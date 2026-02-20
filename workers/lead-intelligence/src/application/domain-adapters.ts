/**
 * Thin adapter classes that wrap the Drizzle infra repo functions
 * into the domain interfaces expected by EnrichmentOrchestrator.
 */

import type {
  EnrichmentCacheEntry,
  EnrichmentCacheRepository,
  ProviderHealthProps,
  ProviderHealthRepository,
  WaterfallConfigProps,
  WaterfallConfigRepository,
} from '@mauntic/lead-intelligence-domain';
import {
  ProviderHealth,
  WaterfallConfig,
} from '@mauntic/lead-intelligence-domain';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  deleteExpiredCache,
  getCacheEntry,
  invalidateCache,
  setCacheEntry,
} from '../infrastructure/repositories/enrichment-cache-repository.js';
import {
  findHealthByOrganization,
  findHealthByProvider,
  upsertHealth,
} from '../infrastructure/repositories/provider-health-repository.js';
import {
  deleteWaterfall,
  findWaterfallByField,
  findWaterfallsByOrganization,
  upsertWaterfall,
} from '../infrastructure/repositories/waterfall-config-repository.js';

export class DrizzleEnrichmentCacheRepository
  implements EnrichmentCacheRepository
{
  constructor(private readonly db: NeonHttpDatabase) {}

  async get(
    orgId: string,
    contactId: string,
    fieldName: string,
  ): Promise<EnrichmentCacheEntry | null> {
    const row = await getCacheEntry(this.db, orgId, contactId, fieldName);
    if (!row) return null;
    return {
      contactId: row.contact_id,
      fieldName: row.field_name,
      providerId: row.provider_id,
      value: row.value,
      confidence: Number(row.confidence),
      expiresAt: row.expires_at,
    };
  }

  async set(orgId: string, entry: EnrichmentCacheEntry): Promise<void> {
    await setCacheEntry(this.db, orgId, {
      contactId: entry.contactId,
      fieldName: entry.fieldName,
      providerId: entry.providerId,
      value: entry.value,
      confidence: String(entry.confidence),
      expiresAt: entry.expiresAt,
    });
  }

  async invalidate(
    orgId: string,
    contactId: string,
    fieldName?: string,
  ): Promise<void> {
    await invalidateCache(this.db, orgId, contactId, fieldName);
  }

  async deleteExpired(): Promise<number> {
    return deleteExpiredCache(this.db);
  }
}

export class DrizzleProviderHealthRepository
  implements ProviderHealthRepository
{
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByProvider(
    orgId: string,
    providerId: string,
  ): Promise<ProviderHealth | null> {
    const row = await findHealthByProvider(this.db, orgId, providerId);
    if (!row) return null;
    return ProviderHealth.reconstitute({
      organizationId: row.organization_id,
      providerId: row.provider_id,
      successCount: row.success_count,
      failureCount: row.failure_count,
      lastFailureAt: row.last_failure_at,
      lastSuccessAt: row.last_success_at,
      circuitState: row.circuit_state as ProviderHealthProps['circuitState'],
      circuitOpenedAt: row.circuit_opened_at,
    });
  }

  async findByOrganization(orgId: string): Promise<ProviderHealth[]> {
    const rows = await findHealthByOrganization(this.db, orgId);
    return rows.map((row) =>
      ProviderHealth.reconstitute({
        organizationId: row.organization_id,
        providerId: row.provider_id,
        successCount: row.success_count,
        failureCount: row.failure_count,
        lastFailureAt: row.last_failure_at,
        lastSuccessAt: row.last_success_at,
        circuitState: row.circuit_state as ProviderHealthProps['circuitState'],
        circuitOpenedAt: row.circuit_opened_at,
      }),
    );
  }

  async save(health: ProviderHealth): Promise<void> {
    const props = health.toProps();
    await upsertHealth(this.db, props.organizationId, {
      provider_id: props.providerId,
      success_count: props.successCount,
      failure_count: props.failureCount,
      last_failure_at: props.lastFailureAt,
      last_success_at: props.lastSuccessAt,
      circuit_state: props.circuitState,
      circuit_opened_at: props.circuitOpenedAt,
    });
  }
}

export class DrizzleWaterfallConfigRepository
  implements WaterfallConfigRepository
{
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByField(
    orgId: string,
    fieldName: string,
  ): Promise<WaterfallConfig | null> {
    const row = await findWaterfallByField(this.db, orgId, fieldName);
    if (!row) return null;
    return WaterfallConfig.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      fieldName: row.field_name,
      providerOrder: row.provider_order,
      maxAttempts: row.max_attempts,
      timeoutMs: row.timeout_ms,
      minConfidence: Number(row.min_confidence),
      cacheTtlDays: row.cache_ttl_days,
      maxCostPerLead: row.max_cost_per_lead
        ? Number(row.max_cost_per_lead)
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as WaterfallConfigProps);
  }

  async findByOrganization(orgId: string): Promise<WaterfallConfig[]> {
    const rows = await findWaterfallsByOrganization(this.db, orgId);
    return rows.map((row) =>
      WaterfallConfig.reconstitute({
        id: row.id,
        organizationId: row.organization_id,
        fieldName: row.field_name,
        providerOrder: row.provider_order,
        maxAttempts: row.max_attempts,
        timeoutMs: row.timeout_ms,
        minConfidence: Number(row.min_confidence),
        cacheTtlDays: row.cache_ttl_days,
        maxCostPerLead: row.max_cost_per_lead
          ? Number(row.max_cost_per_lead)
          : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } as WaterfallConfigProps),
    );
  }

  async save(config: WaterfallConfig): Promise<void> {
    const props = config.toProps();
    await upsertWaterfall(this.db, props.organizationId, {
      id: props.id,
      field_name: props.fieldName,
      provider_order: props.providerOrder,
      max_attempts: props.maxAttempts,
      timeout_ms: props.timeoutMs,
      min_confidence: String(props.minConfidence),
      cache_ttl_days: props.cacheTtlDays,
      max_cost_per_lead:
        props.maxCostPerLead != null ? String(props.maxCostPerLead) : null,
    });
  }

  async delete(orgId: string, id: string): Promise<void> {
    await deleteWaterfall(this.db, orgId, id);
  }
}
