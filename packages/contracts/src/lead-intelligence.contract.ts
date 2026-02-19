import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const EnrichmentProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerType: z.string(),
  supportedFields: z.array(z.string()),
  priority: z.number(),
  costPerLookup: z.number(),
  avgLatencyMs: z.number(),
  successRate: z.number(),
  batchSupported: z.boolean(),
  enabled: z.boolean(),
});

export const EnrichmentJobSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  status: z.string(),
  fieldRequests: z.array(z.string()),
  results: z.array(z.object({
    field: z.string(),
    provider: z.string(),
    value: z.unknown(),
    confidence: z.number(),
    cost: z.number(),
    latencyMs: z.number(),
  })),
  totalCost: z.number(),
  totalLatencyMs: z.number(),
  providersTried: z.array(z.string()),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const LeadIntelligenceProviderHealthSchema = z.object({
  providerId: z.string(),
  successCount: z.number(),
  failureCount: z.number(),
  circuitState: z.string(),
  lastFailureAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
});

export const WaterfallConfigSchema = z.object({
  id: z.string(),
  fieldName: z.string(),
  providerOrder: z.array(z.string()),
  maxAttempts: z.number(),
  timeoutMs: z.number(),
  minConfidence: z.number(),
  cacheTtlDays: z.number(),
  maxCostPerLead: z.number().nullable(),
});

export const LeadIntelligenceDataQualityScoreSchema = z.object({
  completeness: z.number(),
  accuracy: z.number(),
  freshness: z.number(),
  overall: z.number(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const leadIntelligenceContract = c.router({
  // Enrichment
  enrichContact: {
    method: 'POST',
    path: '/api/v1/lead-intelligence/contacts/:contactId/enrich',
    pathParams: z.object({ contactId: z.string().uuid() }),
    body: z.object({
      fields: z.array(z.string()).optional(),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    }),
    responses: { 202: EnrichmentJobSchema },
  },
  enrichBatch: {
    method: 'POST',
    path: '/api/v1/lead-intelligence/contacts/enrich/batch',
    body: z.object({
      contactIds: z.array(z.string().uuid()).min(1).max(100),
      fields: z.array(z.string()).optional(),
    }),
    responses: { 202: z.object({ jobIds: z.array(z.string()) }) },
  },
  getEnrichmentHistory: {
    method: 'GET',
    path: '/api/v1/lead-intelligence/contacts/:contactId/enrichment-history',
    pathParams: z.object({ contactId: z.string().uuid() }),
    query: z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().default(20) }),
    responses: { 200: z.object({ items: z.array(EnrichmentJobSchema), total: z.number() }) },
  },

  // Providers
  listProviders: {
    method: 'GET',
    path: '/api/v1/lead-intelligence/providers',
    responses: { 200: z.array(EnrichmentProviderSchema) },
  },
  configureProvider: {
    method: 'PUT',
    path: '/api/v1/lead-intelligence/providers/:providerId',
    pathParams: z.object({ providerId: z.string() }),
    body: z.object({
      name: z.string(),
      providerType: z.string(),
      supportedFields: z.array(z.string()),
      priority: z.number().int().min(0),
      costPerLookup: z.number().min(0),
      batchSupported: z.boolean().default(false),
      config: z.record(z.unknown()).optional(),
      enabled: z.boolean().default(true),
    }),
    responses: { 200: EnrichmentProviderSchema },
  },

  // Health
  getProviderHealth: {
    method: 'GET',
    path: '/api/v1/lead-intelligence/health',
    responses: { 200: z.array(LeadIntelligenceProviderHealthSchema) },
  },

  // Waterfall Config
  listWaterfallConfigs: {
    method: 'GET',
    path: '/api/v1/lead-intelligence/waterfall',
    responses: { 200: z.array(WaterfallConfigSchema) },
  },
  configureWaterfall: {
    method: 'PUT',
    path: '/api/v1/lead-intelligence/waterfall/:fieldName',
    pathParams: z.object({ fieldName: z.string() }),
    body: z.object({
      providerOrder: z.array(z.string()).min(1),
      maxAttempts: z.number().int().min(1).max(10).optional(),
      timeoutMs: z.number().int().min(100).max(30000).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      cacheTtlDays: z.number().int().min(0).max(365).optional(),
      maxCostPerLead: z.number().min(0).nullable().optional(),
    }),
    responses: { 200: WaterfallConfigSchema },
  },
});
