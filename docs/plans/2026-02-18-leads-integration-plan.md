# Leads Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate all Leads project features (enrichment, scoring, intent signals, AI agents, revenue orchestration) into Mauntic3 as 3 new bounded contexts, fully rewritten in TypeScript.

**Architecture:** 3 new bounded contexts (Lead Intelligence, Scoring & Intent, Revenue Operations) following Mauntic3's existing DDD patterns — domain packages, CF Workers, Fly.io services, Drizzle schemas with RLS. Cross-context communication via domain events.

**Tech Stack:** TypeScript, Hono, ts-rest, Zod, Drizzle ORM, BullMQ, Redis, HTMX, pluggable LLM interface (Claude/OpenAI)

**Ref:** Design doc at `docs/plans/2026-02-18-leads-integration-design.md`

> **Note:** Legacy steps that reference `docker-compose.dev.yml` were part of the original 2026 workflow. The current setup connects to Neon directly and no longer runs Docker locally.

---

## Phase 13: Lead Intelligence — Domain & Schema (Tasks 119-126)

### Task 119: Create lead-intelligence-domain package scaffold

**Files:**
- Create: `packages/domains/lead-intelligence-domain/package.json`
- Create: `packages/domains/lead-intelligence-domain/tsconfig.json`
- Create: `packages/domains/lead-intelligence-domain/drizzle.config.ts`
- Create: `packages/domains/lead-intelligence-domain/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@mauntic/lead-intelligence-domain",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": { "import": "./dist/src/index.js", "types": "./dist/src/index.d.ts" },
    "./drizzle": { "import": "./dist/drizzle/schema.js", "types": "./dist/drizzle/schema.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@mauntic/domain-kernel": "workspace:*",
    "drizzle-orm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "drizzle-kit": "catalog:",
    "typescript": "catalog:"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "drizzle/**/*"]
}
```

**Step 3: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
});
```

**Step 4: Create src/index.ts (empty barrel)**

```typescript
// Lead Intelligence Domain
export * from './entities/index.js';
export * from './repositories/index.js';
export * from './commands/index.js';
export * from './queries/index.js';
export * from './services/index.js';
```

**Step 5: Create directory structure**

```bash
mkdir -p packages/domains/lead-intelligence-domain/src/{entities,repositories,commands,queries,services,events,event-handlers}
mkdir -p packages/domains/lead-intelligence-domain/drizzle/migrations
touch packages/domains/lead-intelligence-domain/src/{entities,repositories,commands,queries,services}/index.ts
```

**Step 6: Install dependencies**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm install
```

**Step 7: Commit**

```bash
git add packages/domains/lead-intelligence-domain/
git commit -m "feat: scaffold lead-intelligence-domain package (Phase 13, Task 119)"
```

---

### Task 120: Define Lead Intelligence branded IDs and domain events

**Files:**
- Modify: `packages/domain-kernel/src/value-objects/branded-id.ts`
- Modify: `packages/domain-kernel/src/events/domain-event.ts`

**Step 1: Add branded IDs**

Add to `branded-id.ts`:

```typescript
// Lead Intelligence IDs
export type EnrichmentJobId = Brand<string, 'EnrichmentJobId'>;
export type EnrichmentProviderId = Brand<string, 'EnrichmentProviderId'>;

export const EnrichmentJobIdSchema = z.string().uuid() as unknown as z.ZodType<EnrichmentJobId>;
export const EnrichmentProviderIdSchema = z.string().min(1) as unknown as z.ZodType<EnrichmentProviderId>;
```

**Step 2: Add domain events**

Add to `domain-event.ts`:

```typescript
// Lead Intelligence Events
export interface LeadEnrichedEvent extends DomainEvent<'leadIntelligence.LeadEnriched', {
  organizationId: number;
  contactId: string;
  changedFields: string[];
  source: string;
  confidence: number;
}> {}

export interface EnrichmentFailedEvent extends DomainEvent<'leadIntelligence.EnrichmentFailed', {
  organizationId: number;
  contactId: string;
  provider: string;
  reason: string;
}> {}

export interface DataQualityChangedEvent extends DomainEvent<'leadIntelligence.DataQualityChanged', {
  organizationId: number;
  contactId: string;
  oldScore: number;
  newScore: number;
}> {}
```

Add these to the `AnyDomainEvent` union type.

**Step 3: Commit**

```bash
git add packages/domain-kernel/
git commit -m "feat: add Lead Intelligence branded IDs and domain events (Phase 13, Task 120)"
```

---

### Task 121: Define Lead Intelligence Drizzle schema

**Files:**
- Create: `packages/domains/lead-intelligence-domain/drizzle/schema.ts`

**Step 1: Write schema**

```typescript
import { pgSchema, uuid, varchar, text, timestamp, jsonb, integer, numeric, boolean } from 'drizzle-orm/pg-core';

export const leadIntelligenceSchema = pgSchema('lead_intelligence');

export const enrichmentProviders = leadIntelligenceSchema.table('enrichment_providers', {
  id: varchar('id', { length: 50 }).primaryKey(),
  organization_id: uuid('organization_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  provider_type: varchar('provider_type', { length: 50 }).notNull(), // clearbit, apollo, zoominfo, hunter, rocketreach, lusha
  supported_fields: jsonb('supported_fields').notNull().$type<string[]>(),
  priority: integer('priority').notNull().default(0),
  cost_per_lookup: numeric('cost_per_lookup', { precision: 10, scale: 4 }).notNull().default('0'),
  avg_latency_ms: integer('avg_latency_ms').default(0),
  success_rate: numeric('success_rate', { precision: 5, scale: 4 }).default('0'),
  batch_supported: boolean('batch_supported').default(false),
  config: jsonb('config').$type<Record<string, unknown>>(), // API keys, endpoints, etc.
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: { columns: [table.organization_id] },
}));

export const waterfallConfigs = leadIntelligenceSchema.table('waterfall_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  field_name: varchar('field_name', { length: 50 }).notNull(), // email, phone, company, title, tech_stack
  provider_order: jsonb('provider_order').notNull().$type<string[]>(), // ordered provider IDs
  max_attempts: integer('max_attempts').notNull().default(3),
  timeout_ms: integer('timeout_ms').notNull().default(5000),
  min_confidence: numeric('min_confidence', { precision: 3, scale: 2 }).notNull().default('0.5'),
  cache_ttl_days: integer('cache_ttl_days').notNull().default(7),
  max_cost_per_lead: numeric('max_cost_per_lead', { precision: 10, scale: 4 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgFieldIdx: { columns: [table.organization_id, table.field_name] },
}));

export const enrichmentJobs = leadIntelligenceSchema.table('enrichment_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed, exhausted
  field_requests: jsonb('field_requests').notNull().$type<string[]>(),
  results: jsonb('results').$type<Array<{
    field: string;
    provider: string;
    value: unknown;
    confidence: number;
    cost: number;
    latencyMs: number;
  }>>(),
  total_cost: numeric('total_cost', { precision: 10, scale: 4 }).default('0'),
  total_latency_ms: integer('total_latency_ms').default(0),
  providers_tried: jsonb('providers_tried').$type<string[]>(),
  error: text('error'),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  statusIdx: { columns: [table.status] },
}));

export const enrichmentCache = leadIntelligenceSchema.table('enrichment_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  field_name: varchar('field_name', { length: 50 }).notNull(),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  value: jsonb('value'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  lookupIdx: { columns: [table.organization_id, table.contact_id, table.field_name] },
  expiryIdx: { columns: [table.expires_at] },
}));

export const providerHealth = leadIntelligenceSchema.table('provider_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  success_count: integer('success_count').notNull().default(0),
  failure_count: integer('failure_count').notNull().default(0),
  last_failure_at: timestamp('last_failure_at'),
  last_success_at: timestamp('last_success_at'),
  circuit_state: varchar('circuit_state', { length: 20 }).notNull().default('closed'), // closed, open, half_open
  circuit_opened_at: timestamp('circuit_opened_at'),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgProviderIdx: { columns: [table.organization_id, table.provider_id] },
}));

export const enrichmentAuditLog = leadIntelligenceSchema.table('enrichment_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  job_id: uuid('job_id'),
  field_name: varchar('field_name', { length: 50 }).notNull(),
  old_value: jsonb('old_value'),
  new_value: jsonb('new_value'),
  provider_id: varchar('provider_id', { length: 50 }).notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id] },
  jobIdx: { columns: [table.job_id] },
}));
```

**Step 2: Commit**

```bash
git add packages/domains/lead-intelligence-domain/drizzle/
git commit -m "feat: add Lead Intelligence Drizzle schema (Phase 13, Task 121)"
```

---

### Task 122: Define Lead Intelligence domain entities

**Files:**
- Create: `packages/domains/lead-intelligence-domain/src/entities/enrichment-provider.ts`
- Create: `packages/domains/lead-intelligence-domain/src/entities/enrichment-job.ts`
- Create: `packages/domains/lead-intelligence-domain/src/entities/waterfall-config.ts`
- Create: `packages/domains/lead-intelligence-domain/src/entities/provider-health.ts`
- Create: `packages/domains/lead-intelligence-domain/src/entities/data-quality-score.ts`
- Modify: `packages/domains/lead-intelligence-domain/src/entities/index.ts`

**Step 1: Write EnrichmentProvider entity**

```typescript
// enrichment-provider.ts
import { z } from 'zod';

export const EnrichmentProviderPropsSchema = z.object({
  id: z.string(),
  organizationId: z.string().uuid(),
  name: z.string(),
  providerType: z.enum(['clearbit', 'apollo', 'zoominfo', 'hunter', 'rocketreach', 'lusha', 'builtwith', 'wappalyzer']),
  supportedFields: z.array(z.string()),
  priority: z.number().int().min(0),
  costPerLookup: z.number().min(0),
  avgLatencyMs: z.number().int().min(0),
  successRate: z.number().min(0).max(1),
  batchSupported: z.boolean(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean(),
});

export type EnrichmentProviderProps = z.infer<typeof EnrichmentProviderPropsSchema>;

export class EnrichmentProvider {
  private constructor(private readonly props: EnrichmentProviderProps) {}

  static create(props: EnrichmentProviderProps): EnrichmentProvider {
    return new EnrichmentProvider(EnrichmentProviderPropsSchema.parse(props));
  }

  static reconstitute(props: EnrichmentProviderProps): EnrichmentProvider {
    return new EnrichmentProvider(props);
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get name() { return this.props.name; }
  get providerType() { return this.props.providerType; }
  get supportedFields() { return this.props.supportedFields; }
  get priority() { return this.props.priority; }
  get costPerLookup() { return this.props.costPerLookup; }
  get avgLatencyMs() { return this.props.avgLatencyMs; }
  get successRate() { return this.props.successRate; }
  get batchSupported() { return this.props.batchSupported; }
  get config() { return this.props.config; }
  get enabled() { return this.props.enabled; }

  supportsField(field: string): boolean {
    return this.props.supportedFields.includes(field);
  }

  toJSON() { return { ...this.props }; }
}
```

**Step 2: Write EnrichmentJob entity**

```typescript
// enrichment-job.ts
import { z } from 'zod';

export const EnrichmentResultSchema = z.object({
  field: z.string(),
  provider: z.string(),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  cost: z.number().min(0),
  latencyMs: z.number().int().min(0),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export const EnrichmentJobStatus = z.enum(['pending', 'running', 'completed', 'failed', 'exhausted']);
export type EnrichmentJobStatus = z.infer<typeof EnrichmentJobStatus>;

export const EnrichmentJobPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  status: EnrichmentJobStatus,
  fieldRequests: z.array(z.string()),
  results: z.array(EnrichmentResultSchema),
  totalCost: z.number().min(0),
  totalLatencyMs: z.number().int().min(0),
  providersTried: z.array(z.string()),
  error: z.string().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type EnrichmentJobProps = z.infer<typeof EnrichmentJobPropsSchema>;

export class EnrichmentJob {
  private constructor(private props: EnrichmentJobProps) {}

  static create(params: { id: string; organizationId: string; contactId: string; fieldRequests: string[] }): EnrichmentJob {
    return new EnrichmentJob({
      ...params,
      status: 'pending',
      results: [],
      totalCost: 0,
      totalLatencyMs: 0,
      providersTried: [],
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: EnrichmentJobProps): EnrichmentJob {
    return new EnrichmentJob(props);
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get contactId() { return this.props.contactId; }
  get status() { return this.props.status; }
  get fieldRequests() { return this.props.fieldRequests; }
  get results() { return this.props.results; }
  get totalCost() { return this.props.totalCost; }
  get totalLatencyMs() { return this.props.totalLatencyMs; }
  get providersTried() { return this.props.providersTried; }
  get error() { return this.props.error; }

  start(): void {
    this.props.status = 'running';
    this.props.startedAt = new Date();
  }

  addResult(result: EnrichmentResult): void {
    this.props.results.push(result);
    this.props.totalCost += result.cost;
    this.props.totalLatencyMs += result.latencyMs;
    if (!this.props.providersTried.includes(result.provider)) {
      this.props.providersTried.push(result.provider);
    }
  }

  complete(): void {
    this.props.status = 'completed';
    this.props.completedAt = new Date();
  }

  fail(error: string): void {
    this.props.status = 'failed';
    this.props.error = error;
    this.props.completedAt = new Date();
  }

  exhaust(): void {
    this.props.status = 'exhausted';
    this.props.completedAt = new Date();
  }

  toJSON() { return { ...this.props }; }
}
```

**Step 3: Write WaterfallConfig, ProviderHealth, DataQualityScore value objects**

```typescript
// waterfall-config.ts
import { z } from 'zod';

export const WaterfallConfigPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  fieldName: z.string(),
  providerOrder: z.array(z.string()),
  maxAttempts: z.number().int().min(1).default(3),
  timeoutMs: z.number().int().min(100).default(5000),
  minConfidence: z.number().min(0).max(1).default(0.5),
  cacheTtlDays: z.number().int().min(0).default(7),
  maxCostPerLead: z.number().min(0).nullable(),
});

export type WaterfallConfigProps = z.infer<typeof WaterfallConfigPropsSchema>;

export class WaterfallConfig {
  private constructor(private readonly props: WaterfallConfigProps) {}

  static create(props: WaterfallConfigProps): WaterfallConfig {
    return new WaterfallConfig(WaterfallConfigPropsSchema.parse(props));
  }

  static reconstitute(props: WaterfallConfigProps): WaterfallConfig {
    return new WaterfallConfig(props);
  }

  get id() { return this.props.id; }
  get organizationId() { return this.props.organizationId; }
  get fieldName() { return this.props.fieldName; }
  get providerOrder() { return this.props.providerOrder; }
  get maxAttempts() { return this.props.maxAttempts; }
  get timeoutMs() { return this.props.timeoutMs; }
  get minConfidence() { return this.props.minConfidence; }
  get cacheTtlDays() { return this.props.cacheTtlDays; }
  get maxCostPerLead() { return this.props.maxCostPerLead; }

  toJSON() { return { ...this.props }; }
}
```

```typescript
// provider-health.ts
import { z } from 'zod';

export const CircuitState = z.enum(['closed', 'open', 'half_open']);
export type CircuitState = z.infer<typeof CircuitState>;

export const ProviderHealthPropsSchema = z.object({
  organizationId: z.string().uuid(),
  providerId: z.string(),
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  lastFailureAt: z.date().nullable(),
  lastSuccessAt: z.date().nullable(),
  circuitState: CircuitState,
  circuitOpenedAt: z.date().nullable(),
});

export type ProviderHealthProps = z.infer<typeof ProviderHealthPropsSchema>;

const CIRCUIT_OPEN_DURATION_MS = 60_000; // 1 minute before half-open
const FAILURE_THRESHOLD = 5;

export class ProviderHealth {
  private constructor(private props: ProviderHealthProps) {}

  static create(organizationId: string, providerId: string): ProviderHealth {
    return new ProviderHealth({
      organizationId,
      providerId,
      successCount: 0,
      failureCount: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      circuitState: 'closed',
      circuitOpenedAt: null,
    });
  }

  static reconstitute(props: ProviderHealthProps): ProviderHealth {
    return new ProviderHealth(props);
  }

  get providerId() { return this.props.providerId; }
  get circuitState() { return this.props.circuitState; }
  get successCount() { return this.props.successCount; }
  get failureCount() { return this.props.failureCount; }

  isAvailable(): boolean {
    if (this.props.circuitState === 'closed') return true;
    if (this.props.circuitState === 'half_open') return true;
    if (this.props.circuitState === 'open' && this.props.circuitOpenedAt) {
      const elapsed = Date.now() - this.props.circuitOpenedAt.getTime();
      if (elapsed >= CIRCUIT_OPEN_DURATION_MS) {
        this.props.circuitState = 'half_open';
        return true;
      }
    }
    return false;
  }

  recordSuccess(): void {
    this.props.successCount++;
    this.props.lastSuccessAt = new Date();
    if (this.props.circuitState === 'half_open') {
      this.props.circuitState = 'closed';
      this.props.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.props.failureCount++;
    this.props.lastFailureAt = new Date();
    if (this.props.failureCount >= FAILURE_THRESHOLD) {
      this.props.circuitState = 'open';
      this.props.circuitOpenedAt = new Date();
    }
  }

  toJSON() { return { ...this.props }; }
}
```

```typescript
// data-quality-score.ts
import { z } from 'zod';

export const DataQualityScoreSchema = z.object({
  completeness: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});

export type DataQualityScore = z.infer<typeof DataQualityScoreSchema>;

export function calculateDataQuality(contact: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  lastEnrichedAt?: Date | null;
}): DataQualityScore {
  const fields = ['email', 'firstName', 'lastName', 'phone', 'company', 'title'] as const;
  const filled = fields.filter(f => contact[f] != null && contact[f] !== '').length;
  const completeness = filled / fields.length;

  const accuracy = contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? 1.0 : 0.5;

  const daysSinceEnrichment = contact.lastEnrichedAt
    ? (Date.now() - contact.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 90;
  const freshness = Math.max(0, 1 - daysSinceEnrichment / 90);

  const overall = completeness * 0.4 + accuracy * 0.3 + freshness * 0.3;

  return { completeness, accuracy, freshness, overall };
}
```

**Step 4: Update entities/index.ts barrel**

```typescript
export { EnrichmentProvider, type EnrichmentProviderProps } from './enrichment-provider.js';
export { EnrichmentJob, type EnrichmentJobProps, type EnrichmentResult, EnrichmentJobStatus } from './enrichment-job.js';
export { WaterfallConfig, type WaterfallConfigProps } from './waterfall-config.js';
export { ProviderHealth, type ProviderHealthProps, type CircuitState } from './provider-health.js';
export { type DataQualityScore, calculateDataQuality } from './data-quality-score.js';
```

**Step 5: Commit**

```bash
git add packages/domains/lead-intelligence-domain/src/entities/
git commit -m "feat: add Lead Intelligence domain entities (Phase 13, Task 122)"
```

---

### Task 123: Define Lead Intelligence repository interfaces

**Files:**
- Create: `packages/domains/lead-intelligence-domain/src/repositories/enrichment-provider-repository.ts`
- Create: `packages/domains/lead-intelligence-domain/src/repositories/enrichment-job-repository.ts`
- Create: `packages/domains/lead-intelligence-domain/src/repositories/waterfall-config-repository.ts`
- Create: `packages/domains/lead-intelligence-domain/src/repositories/provider-health-repository.ts`
- Create: `packages/domains/lead-intelligence-domain/src/repositories/enrichment-cache-repository.ts`
- Modify: `packages/domains/lead-intelligence-domain/src/repositories/index.ts`

**Step 1: Write repository interfaces**

```typescript
// enrichment-provider-repository.ts
import type { EnrichmentProvider } from '../entities/enrichment-provider.js';

export interface EnrichmentProviderRepository {
  findById(organizationId: string, id: string): Promise<EnrichmentProvider | null>;
  findByOrganization(organizationId: string): Promise<EnrichmentProvider[]>;
  findByField(organizationId: string, fieldName: string): Promise<EnrichmentProvider[]>;
  save(provider: EnrichmentProvider): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
}
```

```typescript
// enrichment-job-repository.ts
import type { EnrichmentJob } from '../entities/enrichment-job.js';

export interface EnrichmentJobRepository {
  findById(id: string): Promise<EnrichmentJob | null>;
  findByContact(organizationId: string, contactId: string): Promise<EnrichmentJob[]>;
  findPending(organizationId: string, limit?: number): Promise<EnrichmentJob[]>;
  save(job: EnrichmentJob): Promise<void>;
}
```

```typescript
// waterfall-config-repository.ts
import type { WaterfallConfig } from '../entities/waterfall-config.js';

export interface WaterfallConfigRepository {
  findByField(organizationId: string, fieldName: string): Promise<WaterfallConfig | null>;
  findByOrganization(organizationId: string): Promise<WaterfallConfig[]>;
  save(config: WaterfallConfig): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
}
```

```typescript
// provider-health-repository.ts
import type { ProviderHealth } from '../entities/provider-health.js';

export interface ProviderHealthRepository {
  findByProvider(organizationId: string, providerId: string): Promise<ProviderHealth | null>;
  findByOrganization(organizationId: string): Promise<ProviderHealth[]>;
  save(health: ProviderHealth): Promise<void>;
}
```

```typescript
// enrichment-cache-repository.ts
export interface EnrichmentCacheEntry {
  contactId: string;
  fieldName: string;
  providerId: string;
  value: unknown;
  confidence: number;
  expiresAt: Date;
}

export interface EnrichmentCacheRepository {
  get(organizationId: string, contactId: string, fieldName: string): Promise<EnrichmentCacheEntry | null>;
  set(organizationId: string, entry: EnrichmentCacheEntry): Promise<void>;
  invalidate(organizationId: string, contactId: string, fieldName?: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
```

**Step 2: Update repositories/index.ts**

```typescript
export type { EnrichmentProviderRepository } from './enrichment-provider-repository.js';
export type { EnrichmentJobRepository } from './enrichment-job-repository.js';
export type { WaterfallConfigRepository } from './waterfall-config-repository.js';
export type { ProviderHealthRepository } from './provider-health-repository.js';
export type { EnrichmentCacheRepository, EnrichmentCacheEntry } from './enrichment-cache-repository.js';
```

**Step 3: Commit**

```bash
git add packages/domains/lead-intelligence-domain/src/repositories/
git commit -m "feat: add Lead Intelligence repository interfaces (Phase 13, Task 123)"
```

---

### Task 124: Define Lead Intelligence commands and queries

**Files:**
- Create: `packages/domains/lead-intelligence-domain/src/commands/enrich-contact.ts`
- Create: `packages/domains/lead-intelligence-domain/src/commands/enrich-batch.ts`
- Create: `packages/domains/lead-intelligence-domain/src/commands/configure-waterfall.ts`
- Create: `packages/domains/lead-intelligence-domain/src/commands/configure-provider.ts`
- Create: `packages/domains/lead-intelligence-domain/src/queries/get-enrichment-history.ts`
- Create: `packages/domains/lead-intelligence-domain/src/queries/get-provider-health.ts`
- Create: `packages/domains/lead-intelligence-domain/src/queries/get-waterfall-config.ts`
- Modify: `packages/domains/lead-intelligence-domain/src/commands/index.ts`
- Modify: `packages/domains/lead-intelligence-domain/src/queries/index.ts`

**Step 1: Write commands**

```typescript
// enrich-contact.ts
import { z } from 'zod';

export const EnrichContactCommandSchema = z.object({
  contactId: z.string().uuid(),
  fields: z.array(z.string()).optional(), // if omitted, enrich all configured fields
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type EnrichContactCommand = z.infer<typeof EnrichContactCommandSchema>;
```

```typescript
// enrich-batch.ts
import { z } from 'zod';

export const EnrichBatchCommandSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(100),
  fields: z.array(z.string()).optional(),
});

export type EnrichBatchCommand = z.infer<typeof EnrichBatchCommandSchema>;
```

```typescript
// configure-waterfall.ts
import { z } from 'zod';

export const ConfigureWaterfallCommandSchema = z.object({
  fieldName: z.string(),
  providerOrder: z.array(z.string()).min(1),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  cacheTtlDays: z.number().int().min(0).max(365).optional(),
  maxCostPerLead: z.number().min(0).nullable().optional(),
});

export type ConfigureWaterfallCommand = z.infer<typeof ConfigureWaterfallCommandSchema>;
```

```typescript
// configure-provider.ts
import { z } from 'zod';

export const ConfigureProviderCommandSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerType: z.enum(['clearbit', 'apollo', 'zoominfo', 'hunter', 'rocketreach', 'lusha', 'builtwith', 'wappalyzer']),
  supportedFields: z.array(z.string()),
  priority: z.number().int().min(0),
  costPerLookup: z.number().min(0),
  batchSupported: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export type ConfigureProviderCommand = z.infer<typeof ConfigureProviderCommandSchema>;
```

**Step 2: Write queries**

```typescript
// get-enrichment-history.ts
import { z } from 'zod';

export const GetEnrichmentHistoryQuerySchema = z.object({
  contactId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type GetEnrichmentHistoryQuery = z.infer<typeof GetEnrichmentHistoryQuerySchema>;
```

```typescript
// get-provider-health.ts
import { z } from 'zod';

export const GetProviderHealthQuerySchema = z.object({
  providerId: z.string().optional(), // if omitted, return all
});

export type GetProviderHealthQuery = z.infer<typeof GetProviderHealthQuerySchema>;
```

```typescript
// get-waterfall-config.ts
import { z } from 'zod';

export const GetWaterfallConfigQuerySchema = z.object({
  fieldName: z.string().optional(), // if omitted, return all
});

export type GetWaterfallConfigQuery = z.infer<typeof GetWaterfallConfigQuerySchema>;
```

**Step 3: Update barrels and commit**

```bash
git add packages/domains/lead-intelligence-domain/src/commands/ packages/domains/lead-intelligence-domain/src/queries/
git commit -m "feat: add Lead Intelligence commands and queries (Phase 13, Task 124)"
```

---

### Task 125: Define Lead Intelligence enrichment provider adapter interface and service

**Files:**
- Create: `packages/domains/lead-intelligence-domain/src/services/enrichment-provider-adapter.ts`
- Create: `packages/domains/lead-intelligence-domain/src/services/enrichment-orchestrator.ts`
- Create: `packages/domains/lead-intelligence-domain/src/services/data-quality-service.ts`
- Modify: `packages/domains/lead-intelligence-domain/src/services/index.ts`

**Step 1: Write provider adapter interface**

```typescript
// enrichment-provider-adapter.ts
export interface EnrichmentRequest {
  contactId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  domain?: string;
  linkedinUrl?: string;
}

export interface EnrichmentFieldResult {
  field: string;
  value: unknown;
  confidence: number;
}

export interface EnrichmentAdapterResult {
  success: boolean;
  fields: EnrichmentFieldResult[];
  error?: string;
  latencyMs: number;
  cost: number;
}

export interface EnrichmentProviderAdapter {
  readonly providerId: string;
  readonly supportedFields: readonly string[];
  enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult>;
  enrichBatch?(requests: EnrichmentRequest[]): Promise<EnrichmentAdapterResult[]>;
  healthCheck(): Promise<boolean>;
}
```

**Step 2: Write EnrichmentOrchestrator service**

```typescript
// enrichment-orchestrator.ts
import type { EnrichmentProviderAdapter, EnrichmentRequest } from './enrichment-provider-adapter.js';
import type { EnrichmentCacheRepository } from '../repositories/enrichment-cache-repository.js';
import type { ProviderHealthRepository } from '../repositories/provider-health-repository.js';
import type { WaterfallConfigRepository } from '../repositories/waterfall-config-repository.js';
import { EnrichmentJob } from '../entities/enrichment-job.js';
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
        // Field exhausted all providers
      }
    }

    const allFieldsAttempted = job.fieldRequests.every(
      f => job.results.some(r => r.field === f)
    );

    if (allFieldsAttempted) {
      job.complete();
    } else {
      job.exhaust();
    }
  }
}
```

**Step 3: Write DataQualityService**

```typescript
// data-quality-service.ts
import { calculateDataQuality, type DataQualityScore } from '../entities/data-quality-score.js';

export interface ContactForQuality {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  lastEnrichedAt?: Date | null;
}

export class DataQualityService {
  assess(contact: ContactForQuality): DataQualityScore {
    return calculateDataQuality(contact);
  }
}
```

**Step 4: Update services/index.ts and commit**

```bash
git add packages/domains/lead-intelligence-domain/src/services/
git commit -m "feat: add Lead Intelligence orchestrator and services (Phase 13, Task 125)"
```

---

### Task 126: Add Lead Intelligence ts-rest contract

**Files:**
- Create: `packages/contracts/src/lead-intelligence.contract.ts`
- Modify: `packages/contracts/src/index.ts`

**Step 1: Write contract**

```typescript
// lead-intelligence.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

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

export const ProviderHealthSchema = z.object({
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

export const DataQualityScoreSchema = z.object({
  completeness: z.number(),
  accuracy: z.number(),
  freshness: z.number(),
  overall: z.number(),
});

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
    responses: { 200: z.array(ProviderHealthSchema) },
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
```

**Step 2: Add to contracts/src/index.ts**

```typescript
export { leadIntelligenceContract, EnrichmentProviderSchema, EnrichmentJobSchema, ProviderHealthSchema, WaterfallConfigSchema, DataQualityScoreSchema } from './lead-intelligence.contract.js';
```

**Step 3: Commit**

```bash
git add packages/contracts/src/
git commit -m "feat: add Lead Intelligence ts-rest contract (Phase 13, Task 126)"
```

---

## Phase 14: Lead Intelligence — Worker, Service & Provider Adapters (Tasks 127-134)

### Task 127: Create lead-intelligence CF Worker scaffold

**Files:**
- Create: `workers/lead-intelligence/package.json`
- Create: `workers/lead-intelligence/tsconfig.json`
- Create: `workers/lead-intelligence/wrangler.toml`
- Create: `workers/lead-intelligence/src/index.ts`
- Create: `workers/lead-intelligence/src/app.tsx`

Follow the exact patterns from `workers/crm/` — Hono app with middleware stack (logger, cors, errorHandler, database, tenantMiddleware). Mount routes from `src/interface/`.

**Step 1: Commit scaffold**

```bash
git add workers/lead-intelligence/
git commit -m "feat: scaffold lead-intelligence CF Worker (Phase 14, Task 127)"
```

---

### Task 128: Implement Lead Intelligence Drizzle repositories

**Files:**
- Create: `workers/lead-intelligence/src/infrastructure/repositories/enrichment-provider-repository.ts`
- Create: `workers/lead-intelligence/src/infrastructure/repositories/enrichment-job-repository.ts`
- Create: `workers/lead-intelligence/src/infrastructure/repositories/waterfall-config-repository.ts`
- Create: `workers/lead-intelligence/src/infrastructure/repositories/provider-health-repository.ts`
- Create: `workers/lead-intelligence/src/infrastructure/repositories/enrichment-cache-repository.ts`
- Create: `workers/lead-intelligence/src/infrastructure/repositories/index.ts`

Implement each repository interface from the domain package using Drizzle ORM, following the patterns from `workers/crm/src/infrastructure/repositories/`.

All queries scoped by `organization_id` for RLS.

**Step 1: Commit**

```bash
git add workers/lead-intelligence/src/infrastructure/
git commit -m "feat: implement Lead Intelligence Drizzle repositories (Phase 14, Task 128)"
```

---

### Task 129: Implement Clearbit enrichment provider adapter

**Files:**
- Create: `workers/lead-intelligence/src/adapters/clearbit-adapter.ts`

**Step 1: Implement adapter**

```typescript
import type { EnrichmentProviderAdapter, EnrichmentRequest, EnrichmentAdapterResult } from '@mauntic/lead-intelligence-domain';

export class ClearbitAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'clearbit';
  readonly supportedFields = ['email', 'firstName', 'lastName', 'company', 'title', 'industry', 'companySize', 'linkedinUrl'] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const response = await fetch(`https://person-stream.clearbit.com/v2/combined/find?email=${encodeURIComponent(request.email ?? '')}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return { success: false, fields: [], error: `HTTP ${response.status}`, latencyMs: Date.now() - start, cost: 0 };
      }

      const data = await response.json() as Record<string, unknown>;
      const person = data.person as Record<string, unknown> | undefined;
      const company = data.company as Record<string, unknown> | undefined;

      const fields = [];
      if (person?.email) fields.push({ field: 'email', value: person.email, confidence: 0.95 });
      if (person?.name?.givenName) fields.push({ field: 'firstName', value: person.name.givenName, confidence: 0.95 });
      if (person?.name?.familyName) fields.push({ field: 'lastName', value: person.name.familyName, confidence: 0.95 });
      if (person?.employment?.title) fields.push({ field: 'title', value: person.employment.title, confidence: 0.9 });
      if (person?.linkedin?.handle) fields.push({ field: 'linkedinUrl', value: `https://linkedin.com/in/${person.linkedin.handle}`, confidence: 0.95 });
      if (company?.name) fields.push({ field: 'company', value: company.name, confidence: 0.95 });
      if (company?.category?.industry) fields.push({ field: 'industry', value: company.category.industry, confidence: 0.85 });
      if (company?.metrics?.employees) fields.push({ field: 'companySize', value: company.metrics.employees, confidence: 0.8 });

      return { success: true, fields, latencyMs: Date.now() - start, cost: 0.05 };
    } catch (error) {
      return { success: false, fields: [], error: String(error), latencyMs: Date.now() - start, cost: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://person-stream.clearbit.com/v2/combined/find?email=test@example.com', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.status !== 500;
    } catch {
      return false;
    }
  }
}
```

**Step 2: Commit**

```bash
git add workers/lead-intelligence/src/adapters/
git commit -m "feat: implement Clearbit enrichment adapter (Phase 14, Task 129)"
```

---

### Task 130: Implement Apollo enrichment provider adapter

**Files:**
- Create: `workers/lead-intelligence/src/adapters/apollo-adapter.ts`

Similar pattern to Clearbit but using Apollo's People Enrichment API (`https://api.apollo.io/api/v1/people/match`). Supports email, phone, title, company, LinkedIn.

**Step 1: Commit**

```bash
git add workers/lead-intelligence/src/adapters/apollo-adapter.ts
git commit -m "feat: implement Apollo enrichment adapter (Phase 14, Task 130)"
```

---

### Task 131: Implement Hunter, ZoomInfo, RocketReach, Lusha adapters

**Files:**
- Create: `workers/lead-intelligence/src/adapters/hunter-adapter.ts`
- Create: `workers/lead-intelligence/src/adapters/zoominfo-adapter.ts`
- Create: `workers/lead-intelligence/src/adapters/rocketreach-adapter.ts`
- Create: `workers/lead-intelligence/src/adapters/lusha-adapter.ts`
- Create: `workers/lead-intelligence/src/adapters/index.ts`

Each follows the `EnrichmentProviderAdapter` interface. Hunter specializes in email finding, ZoomInfo in phone/company data, RocketReach in contact info, Lusha in direct dials.

**Step 1: Commit**

```bash
git add workers/lead-intelligence/src/adapters/
git commit -m "feat: implement Hunter, ZoomInfo, RocketReach, Lusha adapters (Phase 14, Task 131)"
```

---

### Task 132: Implement Lead Intelligence API routes

**Files:**
- Create: `workers/lead-intelligence/src/interface/enrichment-routes.ts`
- Create: `workers/lead-intelligence/src/interface/provider-routes.ts`
- Create: `workers/lead-intelligence/src/interface/health-routes.ts`
- Create: `workers/lead-intelligence/src/interface/waterfall-routes.ts`

Implement ts-rest/Hono route handlers for all endpoints defined in the contract. Follow the pattern from `workers/crm/src/interface/contact-routes.ts`.

**Step 1: Commit**

```bash
git add workers/lead-intelligence/src/interface/
git commit -m "feat: implement Lead Intelligence API routes (Phase 14, Task 132)"
```

---

### Task 133: Create enrichment-engine Fly.io service

**Files:**
- Create: `services/enrichment-engine/package.json`
- Create: `services/enrichment-engine/tsconfig.json`
- Create: `services/enrichment-engine/fly.toml`
- Create: `services/enrichment-engine/Dockerfile`
- Create: `services/enrichment-engine/src/index.ts`

Follow the pattern from `services/journey-executor/`. BullMQ workers for:
- `enrichment-job-handler` — processes enrichment jobs using the orchestrator (concurrency: 5)
- `batch-enrichment-handler` — processes batch enrichment requests (concurrency: 2)
- `cache-cleanup-handler` — scheduled job to delete expired cache entries (hourly)
- `provider-health-check-handler` — scheduled health checks on providers (every 15 min)

**Step 1: Commit**

```bash
git add services/enrichment-engine/
git commit -m "feat: create enrichment-engine Fly.io service (Phase 14, Task 133)"
```

---

### Task 134: Add CRM contact enrichment columns and event handlers

**Files:**
- Modify: `packages/domains/crm-domain/drizzle/schema.ts` — add `lead_score`, `lead_grade`, `intent_score`, `enrichment_status`, `last_enriched_at`, `data_quality_score` columns to contacts table
- Modify: `workers/crm/src/events/contact-events.ts` — add handler for `LeadEnrichedEvent` that updates contact fields

**Step 1: Add columns to contacts table**

```typescript
// Add to contacts table definition:
lead_score: numeric('lead_score', { precision: 5, scale: 2 }),
lead_grade: varchar('lead_grade', { length: 1 }),
intent_score: numeric('intent_score', { precision: 5, scale: 2 }),
enrichment_status: varchar('enrichment_status', { length: 20 }),
last_enriched_at: timestamp('last_enriched_at'),
data_quality_score: numeric('data_quality_score', { precision: 3, scale: 2 }),
```

**Step 2: Generate migration**

```bash
cd packages/domains/crm-domain && pnpm db:generate
```

**Step 3: Commit**

```bash
git add packages/domains/crm-domain/
git add workers/crm/src/events/
git commit -m "feat: add enrichment columns to CRM contacts table (Phase 14, Task 134)"
```

---

## Phase 15: Scoring & Intent — Domain & Schema (Tasks 135-142)

### Task 135: Create scoring-domain package scaffold

Same pattern as Task 119 but for `@mauntic/scoring-domain` with schema `scoring`.

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/
git commit -m "feat: scaffold scoring-domain package (Phase 15, Task 135)"
```

---

### Task 136: Define Scoring & Intent branded IDs and domain events

**Files:**
- Modify: `packages/domain-kernel/src/value-objects/branded-id.ts`
- Modify: `packages/domain-kernel/src/events/domain-event.ts`

**Step 1: Add branded IDs**

```typescript
export type LeadScoreId = Brand<string, 'LeadScoreId'>;
export type IntentSignalId = Brand<string, 'IntentSignalId'>;
export type SignalAlertId = Brand<string, 'SignalAlertId'>;

export const LeadScoreIdSchema = z.string().uuid() as unknown as z.ZodType<LeadScoreId>;
export const IntentSignalIdSchema = z.string().uuid() as unknown as z.ZodType<IntentSignalId>;
export const SignalAlertIdSchema = z.string().uuid() as unknown as z.ZodType<SignalAlertId>;
```

**Step 2: Add domain events**

```typescript
export interface LeadScoredEvent extends DomainEvent<'scoring.LeadScored', {
  organizationId: number;
  contactId: string;
  score: number;
  grade: string;
  previousScore: number | null;
  topContributors: Array<{ factor: string; points: number }>;
}> {}

export interface ScoreThresholdCrossedEvent extends DomainEvent<'scoring.ScoreThresholdCrossed', {
  organizationId: number;
  contactId: string;
  threshold: number;
  direction: 'up' | 'down';
  score: number;
}> {}

export interface IntentSignalDetectedEvent extends DomainEvent<'scoring.IntentSignalDetected', {
  organizationId: number;
  contactId: string;
  signalType: string;
  weight: number;
  source: string;
}> {}

export interface SignalAlertCreatedEvent extends DomainEvent<'scoring.SignalAlertCreated', {
  organizationId: number;
  contactId: string;
  priority: string;
  deadline: string;
  signalType: string;
}> {}
```

**Step 3: Commit**

```bash
git add packages/domain-kernel/
git commit -m "feat: add Scoring & Intent branded IDs and domain events (Phase 15, Task 136)"
```

---

### Task 137: Define Scoring & Intent Drizzle schema

**Files:**
- Create: `packages/domains/scoring-domain/drizzle/schema.ts`

Tables:
- `lead_scores` — current score per contact (totalScore, grade, components, topContributors, scoredAt)
- `score_history` — daily snapshots (contactId, date, totalScore, engagementScore, fitScore, intentScore)
- `intent_signals` — active signals per contact (signalType, source, weight, detectedAt, expiresAt, decayModel)
- `signal_configs` — per-org signal type configuration (signalType, weight, decayHours, tier, enabled)
- `signal_alerts` — alerts with SLA tracking (contactId, signalType, priority, deadline, acknowledgedAt)
- `scoring_configs` — per-org scoring weights (category, factor, weight)

All tables scoped by `organization_id`.

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/drizzle/
git commit -m "feat: add Scoring & Intent Drizzle schema (Phase 15, Task 137)"
```

---

### Task 138: Define Scoring & Intent domain entities

**Files:**
- Create: `packages/domains/scoring-domain/src/entities/lead-score.ts`
- Create: `packages/domains/scoring-domain/src/entities/intent-signal.ts`
- Create: `packages/domains/scoring-domain/src/entities/signal-config.ts`
- Create: `packages/domains/scoring-domain/src/entities/signal-alert.ts`
- Create: `packages/domains/scoring-domain/src/entities/score-history.ts`
- Modify: `packages/domains/scoring-domain/src/entities/index.ts`

**LeadScore** aggregate root with `totalScore` (0-100), `grade` (A/B/C/D/F), component scores, and `topContributors[]`.

**IntentSignal** value object with 44 signal types (see design doc appendix), time-decay calculation:
```typescript
currentWeight(): number {
  const elapsed = (Date.now() - this.detectedAt.getTime()) / (1000 * 60 * 60);
  const decayHours = this.decayHours;
  if (elapsed >= decayHours) return 0;
  return this.weight * (1 - elapsed / decayHours); // linear decay
}
```

**SignalConfig** per-org configuration for each signal type.

**SignalAlert** with priority (CRITICAL/HIGH/MEDIUM/LOW), deadline, and acknowledgment tracking.

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/src/entities/
git commit -m "feat: add Scoring & Intent domain entities (Phase 15, Task 138)"
```

---

### Task 139: Define Scoring & Intent repository interfaces

**Files:**
- Create: `packages/domains/scoring-domain/src/repositories/lead-score-repository.ts`
- Create: `packages/domains/scoring-domain/src/repositories/intent-signal-repository.ts`
- Create: `packages/domains/scoring-domain/src/repositories/signal-config-repository.ts`
- Create: `packages/domains/scoring-domain/src/repositories/signal-alert-repository.ts`
- Create: `packages/domains/scoring-domain/src/repositories/score-history-repository.ts`
- Create: `packages/domains/scoring-domain/src/repositories/scoring-config-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/index.ts`

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/src/repositories/
git commit -m "feat: add Scoring & Intent repository interfaces (Phase 15, Task 139)"
```

---

### Task 140: Define Scoring & Intent services (ScoringEngine, SignalDetector, SignalRouter)

**Files:**
- Create: `packages/domains/scoring-domain/src/services/scoring-model.ts` — ScoringModel interface + RuleBasedScorer implementation
- Create: `packages/domains/scoring-domain/src/services/scoring-engine.ts` — orchestrates feature collection and scoring
- Create: `packages/domains/scoring-domain/src/services/signal-detector.ts` — maps domain events to intent signals
- Create: `packages/domains/scoring-domain/src/services/signal-router.ts` — routes signals to alerts by priority
- Modify: `packages/domains/scoring-domain/src/services/index.ts`

**RuleBasedScorer** default weights (from design doc):
- has_email: +10, has_phone: +15, has_direct_phone: +10
- company_size_smb: +5, mid: +10, enterprise: +15
- seniority_c_level: +20, vp: +15, director: +10, manager: +5
- high_engagement: +15, medium: +10, content_download: +10
- pricing_page: +20, demo_request: +30, free_trial: +25

Grade mapping: A (80-100), B (60-79), C (40-59), D (20-39), F (0-19)

**SignalDetector** maps events to signal types:
- `content.PageVisited` where url contains `/pricing` → PRICING_PAGE
- `content.FormSubmitted` where form type is `demo` → DEMO_REQUEST
- `delivery.MessageOpened` → EMAIL_OPEN (weak signal)
- `delivery.MessageClicked` → EMAIL_CLICK (moderate signal)
- etc.

**SignalRouter** priority mapping:
- CRITICAL (1h SLA): DEMO_REQUEST, PRICING_PAGE, MEETING_SCHEDULED
- HIGH (4h SLA): FUNDING_ROUND, G2_RESEARCH, JOB_CHANGE
- MEDIUM (24h SLA): CONTENT_DOWNLOAD, WEBINAR_ATTENDED
- LOW (72h SLA): WEBSITE_VISIT, EMAIL_OPEN

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/src/services/
git commit -m "feat: add Scoring & Intent services (Phase 15, Task 140)"
```

---

### Task 141: Define Scoring & Intent commands, queries, and contract

**Files:**
- Create: `packages/domains/scoring-domain/src/commands/` — recalculate-scores.ts, configure-scoring.ts, configure-signal.ts, acknowledge-alert.ts
- Create: `packages/domains/scoring-domain/src/queries/` — get-score.ts, get-score-history.ts, list-signals.ts, list-alerts.ts, get-leaderboard.ts
- Create: `packages/contracts/src/scoring.contract.ts`
- Modify: `packages/contracts/src/index.ts`

Contract endpoints per design doc:
- `GET /contacts/:id/score`, `GET /contacts/:id/score/history`, `GET /contacts/:id/signals`
- `POST /scoring/recalculate`, `PUT /scoring/config`
- `GET /scoring/leaderboard`, `GET /signals/alerts`

**Step 1: Commit**

```bash
git add packages/domains/scoring-domain/src/commands/ packages/domains/scoring-domain/src/queries/ packages/contracts/src/
git commit -m "feat: add Scoring & Intent commands, queries, and contract (Phase 15, Task 141)"
```

---

### Task 142: Create scoring CF Worker and queue worker (Cloudflare-native)

**Files:**
- Create: `workers/scoring/` — scaffold with Hono app, routes, Drizzle repos
- Create: `workers/scoring-queue/` — queue consumers for scoring jobs (replaces the old Fly service)

**Scoring Worker** (CF): Real-time signal detection (listens to domain events), serves score/signal APIs.

**Scoring Queue Worker** (Cloudflare Queues):
- `scoring-job-handler` — recalculates score for a contact (concurrency: 10)
- `batch-scoring-handler` — hourly batch rescoring of all contacts with recent activity
- `signal-decay-handler` — hourly cleanup of expired signals
- `alert-expiry-handler` — marks overdue alerts

**Step 1: Commit**

```bash
git add workers/scoring/ workers/scoring-queue/
git commit -m "feat: create Scoring HTTP + queue workers (Phase 15, Task 142)"
```

---

## Phase 16: Revenue Operations — Domain & Schema (Tasks 143-150)

### Task 143: Create revops-domain package scaffold

Same pattern as Task 119 but for `@mauntic/revops-domain` with schema `revops`.

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/
git commit -m "feat: scaffold revops-domain package (Phase 16, Task 143)"
```

---

### Task 144: Define Revenue Operations branded IDs and domain events

**Files:**
- Modify: `packages/domain-kernel/src/value-objects/branded-id.ts`
- Modify: `packages/domain-kernel/src/events/domain-event.ts`

**IDs**: DealId, ForecastId, RoutingRuleId, SequenceId, ProspectId, ActivityId, WorkflowId, ResearchJobId

**Events**: DealCreatedEvent, DealStageChangedEvent, DealWonEvent, DealLostEvent, ProspectQualifiedEvent, SequenceStepExecutedEvent, ResearchCompletedEvent

**Step 1: Commit**

```bash
git add packages/domain-kernel/
git commit -m "feat: add Revenue Operations branded IDs and domain events (Phase 16, Task 144)"
```

---

### Task 145: Define Revenue Operations Drizzle schema

**Files:**
- Create: `packages/domains/revops-domain/drizzle/schema.ts`

Tables:
- `deals` — pipeline management (dealId, accountId, contactId, stage, value, probability, priority, assignedRep, expectedCloseAt)
- `activities` — sales activities (type, contactId, dealId, outcome, duration, notes)
- `forecasts` — revenue forecasting (period, repId, pipeline/best_case/commit/closed values)
- `routing_rules` — lead routing (strategy, conditions, targetReps)
- `sequences` — SDR sequences (name, steps JSONB, dailyLimits, sendWindow)
- `sequence_enrollments` — contacts enrolled in sequences (contactId, sequenceId, currentStep, status)
- `prospects` — SDR qualification results (contactId, qualificationScore, reasoning, icpMatch, recommendation)
- `research_jobs` — AI research requests (contactId, type, status, results JSONB)
- `research_insights` — cached research insights (contactId, insightType, content, relevance, freshness)
- `workflows` — automation workflows (name, trigger, conditions, actions)
- `workflow_executions` — execution log (workflowId, dealId, triggeredAt, status)

All scoped by `organization_id`.

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/drizzle/
git commit -m "feat: add Revenue Operations Drizzle schema (Phase 16, Task 145)"
```

---

### Task 146: Define Revenue Operations domain entities — Deal, Activity, Forecast

**Files:**
- Create: `packages/domains/revops-domain/src/entities/deal.ts`
- Create: `packages/domains/revops-domain/src/entities/activity.ts`
- Create: `packages/domains/revops-domain/src/entities/forecast.ts`

**Deal** aggregate with 8-stage pipeline (prospecting through closed_won/lost), probability mapping, stage transitions with validation.

**Activity** value object with 8 types (call, email, meeting, demo, task, note, linkedin, sms).

**Forecast** with weighted calculation: `closed×1.0 + commit×1.0 + best_case×0.5 + pipeline×0.25`.

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/src/entities/
git commit -m "feat: add Deal, Activity, Forecast entities (Phase 16, Task 146)"
```

---

### Task 147: Define Revenue Operations domain entities — Routing, Sequence, Prospect

**Files:**
- Create: `packages/domains/revops-domain/src/entities/routing-rule.ts`
- Create: `packages/domains/revops-domain/src/entities/sequence.ts`
- Create: `packages/domains/revops-domain/src/entities/prospect.ts`
- Modify: `packages/domains/revops-domain/src/entities/index.ts`

**RoutingRule** with 5 strategies: round_robin, weighted, territory, skill_based, load_balanced.

**Sequence** with up to 8 steps, step types (email, linkedin_connect, linkedin_message, sms, phone_call, wait), A/B variants, daily limits (100 email, 50 LinkedIn, 25 SMS).

**Prospect** with ICP matching, qualification score, and recommendation (enrich/sequence/skip/manual_review).

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/src/entities/
git commit -m "feat: add RoutingRule, Sequence, Prospect entities (Phase 16, Task 147)"
```

---

### Task 148: Define Revenue Operations AI agent interfaces

**Files:**
- Create: `packages/domains/revops-domain/src/services/llm-provider.ts` — pluggable LLM interface
- Create: `packages/domains/revops-domain/src/services/research-agent.ts` — research agent service
- Create: `packages/domains/revops-domain/src/services/sdr-agent.ts` — SDR agent service (3 modes)
- Create: `packages/domains/revops-domain/src/services/deal-inspector.ts` — deal health analysis
- Create: `packages/domains/revops-domain/src/services/sales-coach.ts` — email/call coaching
- Create: `packages/domains/revops-domain/src/services/email-copilot.ts` — email generation

**Step 1: Write LLM provider interface**

```typescript
// llm-provider.ts
export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  stream(prompt: string, options?: LLMOptions): AsyncIterable<string>;
}
```

**Research Agent** — company research (profile, funding, tech stack, hiring, news), person research (LinkedIn, publications, shared connections), personalization insights (14 types) with quality scoring.

**SDR Agent** — 3 modes (autopilot/copilot/learning), ICP matching, qualification scoring, sequence recommendation, response handling with sentiment analysis.

**Deal Inspector** — flags at-risk deals based on activity recency, stage velocity, engagement signals.

**Sales Coach** — reviews drafts, suggests improvements based on deal context.

**Email Copilot** — generates personalized outreach using research insights, A/B subject lines, token substitution.

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/src/services/
git commit -m "feat: add Revenue Operations AI agent interfaces (Phase 16, Task 148)"
```

---

### Task 149: Define Revenue Operations workflow engine

**Files:**
- Create: `packages/domains/revops-domain/src/services/workflow-engine.ts`

Triggers: deal_created, stage_changed, deal_won/lost, inactivity, score_changed, time_in_stage

Actions: send_email, create_task, update_field, assign_owner, notify, call_webhook, add_to_sequence, move_stage

Workflow evaluation: when trigger fires, evaluate conditions, execute actions in order.

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/src/services/workflow-engine.ts
git commit -m "feat: add Revenue Operations workflow engine (Phase 16, Task 149)"
```

---

### Task 150: Define Revenue Operations commands, queries, contract, and repositories

**Files:**
- Create: `packages/domains/revops-domain/src/commands/` — create-deal.ts, update-deal-stage.ts, log-activity.ts, qualify-prospect.ts, create-sequence.ts, enroll-sequence.ts, run-research.ts, configure-routing.ts, create-workflow.ts
- Create: `packages/domains/revops-domain/src/queries/` — get-deal.ts, list-deals.ts, get-forecast.ts, list-prospects.ts, get-insights.ts, list-sequences.ts, get-pipeline-metrics.ts
- Create: `packages/domains/revops-domain/src/repositories/` — all repository interfaces
- Create: `packages/contracts/src/revops.contract.ts`
- Modify: `packages/contracts/src/index.ts`

**Step 1: Commit**

```bash
git add packages/domains/revops-domain/src/ packages/contracts/src/
git commit -m "feat: add Revenue Operations commands, queries, contract, repos (Phase 16, Task 150)"
```

---

## Phase 17: Revenue Operations — Worker, Service & AI Agents (Tasks 151-158)

### Task 151: Create revops CF Worker scaffold

**Files:**
- Create: `workers/revops/` — Hono app with routes for deals, forecasting, routing, SDR, research, agents

Follow worker pattern from `workers/crm/`.

**Step 1: Commit**

```bash
git add workers/revops/
git commit -m "feat: scaffold revops CF Worker (Phase 17, Task 151)"
```

---

### Task 152: Implement Revenue Operations Drizzle repositories

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/` — deal, activity, forecast, routing, sequence, prospect, research, workflow repositories

**Step 1: Commit**

```bash
git add workers/revops/src/infrastructure/
git commit -m "feat: implement Revenue Operations Drizzle repositories (Phase 17, Task 152)"
```

---

### Task 153: Implement Revenue Operations API routes

**Files:**
- Create: `workers/revops/src/interface/deal-routes.ts`
- Create: `workers/revops/src/interface/forecast-routes.ts`
- Create: `workers/revops/src/interface/routing-routes.ts`
- Create: `workers/revops/src/interface/sdr-routes.ts`
- Create: `workers/revops/src/interface/research-routes.ts`
- Create: `workers/revops/src/interface/agent-routes.ts`
- Create: `workers/revops/src/interface/workflow-routes.ts`

**Step 1: Commit**

```bash
git add workers/revops/src/interface/
git commit -m "feat: implement Revenue Operations API routes (Phase 17, Task 153)"
```

---

### Task 154: Implement Claude LLM provider adapter

**Files:**
- Create: `workers/revops/src/adapters/claude-llm-provider.ts`

```typescript
import type { LLMProvider, LLMOptions, LLMResponse } from '@mauntic/revops-domain';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeLLMProvider implements LLMProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: options?.model ?? 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(prompt: string, options?: LLMOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: options?.model ?? 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
```

**Step 1: Commit**

```bash
git add workers/revops/src/adapters/claude-llm-provider.ts
git commit -m "feat: implement Claude LLM provider adapter (Phase 17, Task 154)"
```

---

### Task 155: Implement OpenAI LLM provider adapter

**Files:**
- Create: `workers/revops/src/adapters/openai-llm-provider.ts`

Same interface, using OpenAI SDK. Maps to `gpt-4o` by default.

**Step 1: Commit**

```bash
git add workers/revops/src/adapters/openai-llm-provider.ts
git commit -m "feat: implement OpenAI LLM provider adapter (Phase 17, Task 155)"
```

---

### Task 156: Create revops-engine Fly.io service

**Files:**
- Create: `services/revops-engine/package.json`
- Create: `services/revops-engine/tsconfig.json`
- Create: `services/revops-engine/fly.toml`
- Create: `services/revops-engine/Dockerfile`
- Create: `services/revops-engine/src/index.ts`

BullMQ workers:
- `research-worker` — executes AI research jobs (concurrency: 3)
- `sdr-worker` — executes sequence steps, handles responses (concurrency: 5)
- `routing-worker` — processes lead routing on contact creation (concurrency: 10)
- `forecast-worker` — daily pipeline forecast aggregation (scheduled: 0 6 * * *)
- `workflow-worker` — evaluates and executes workflow triggers (concurrency: 5)
- `deal-health-checker` — scheduled deal health analysis (every 4 hours)

**Step 1: Commit**

```bash
git add services/revops-engine/
git commit -m "feat: create revops-engine Fly.io service (Phase 17, Task 156)"
```

---

### Task 157: Implement Research Agent execution logic

**Files:**
- Modify: `services/revops-engine/src/index.ts` — implement research-worker job handler

Research execution flow:
1. Receive research job (contactId, type: company/person)
2. Fetch contact data from CRM
3. Call LLM with structured prompts for research type
4. Parse structured response (company profile, funding, tech stack, news, etc.)
5. Score insights (relevance × freshness × uniqueness, threshold ≥ 0.7)
6. Save insights to research_insights table
7. Publish ResearchCompletedEvent

**Step 1: Commit**

```bash
git add services/revops-engine/
git commit -m "feat: implement Research Agent execution (Phase 17, Task 157)"
```

---

### Task 158: Implement SDR Agent execution logic

**Files:**
- Modify: `services/revops-engine/src/index.ts` — implement sdr-worker job handler

SDR execution flow:
1. Qualification: ICP match + score threshold + data completeness check
2. If missing data → recommend enrichment, publish event
3. If qualified → select sequence based on contact profile
4. Execute sequence steps respecting daily limits and send windows
5. Response handling: sentiment analysis via LLM, intent classification
6. Metrics tracking: reply rate, meeting booking rate

3 modes:
- **Autopilot**: executes fully
- **Copilot**: creates suggestions, waits for human approval
- **Learning**: logs what it would do, doesn't execute

**Step 1: Commit**

```bash
git add services/revops-engine/
git commit -m "feat: implement SDR Agent execution (Phase 17, Task 158)"
```

---

## Phase 18: Cross-Context Integration (Tasks 159-165)

### Task 159: Add score-based triggers to Journey domain

**Files:**
- Modify: `packages/domains/journey-domain/drizzle/schema.ts` — add `score_threshold` and `intent_signal` to trigger type enum
- Modify: `services/journey-executor/src/index.ts` — add event listeners for `LeadScoredEvent` and `IntentSignalDetectedEvent`, evaluate score-based triggers

**Trigger config examples:**
```json
{ "type": "score_threshold", "config": { "minScore": 80, "direction": "up" } }
{ "type": "intent_signal", "config": { "signalType": "DEMO_REQUEST" } }
```

**Step 1: Commit**

```bash
git add packages/domains/journey-domain/ services/journey-executor/
git commit -m "feat: add score-based triggers to Journey domain (Phase 18, Task 159)"
```

---

### Task 160: Add score-based splits to Journey domain

**Files:**
- Modify: `packages/domains/journey-domain/drizzle/schema.ts` — add `score_range` and `lead_grade` to split condition types
- Modify: `services/journey-executor/src/index.ts` — implement score-based split evaluation

**Split config examples:**
```json
{ "type": "score_range", "config": { "ranges": [{ "min": 80, "branch": "hot" }, { "min": 50, "branch": "warm" }, { "branch": "cold" }] } }
{ "type": "lead_grade", "config": { "grades": { "A": "vip_path", "B": "standard_path", "default": "nurture_path" } } }
```

**Step 1: Commit**

```bash
git add packages/domains/journey-domain/ services/journey-executor/
git commit -m "feat: add score-based splits to Journey domain (Phase 18, Task 160)"
```

---

### Task 161: Add score-based filtering to Campaign domain

**Files:**
- Modify: `packages/domains/campaign-domain/src/entities/campaign.ts` — add optional `minScore`, `maxScore`, `grades` filter fields
- Modify: `workers/campaign/src/interface/campaign-routes.ts` — apply score filters when resolving campaign audience
- Modify: `packages/contracts/src/campaign.contract.ts` — add score filter params to campaign creation/update

**Step 1: Commit**

```bash
git add packages/domains/campaign-domain/ workers/campaign/ packages/contracts/src/campaign.contract.ts
git commit -m "feat: add score-based filtering to Campaign domain (Phase 18, Task 161)"
```

---

### Task 162: Add scoring and enrichment analytics aggregations

**Files:**
- Modify: `packages/domains/analytics-domain/drizzle/schema.ts` — add tables: `daily_score_distribution`, `engagement_cohorts`, `score_trends`, `enrichment_metrics`
- Modify: `workers/analytics/src/queue/queue-worker.ts` — add scheduled jobs for score distribution and enrichment metrics aggregation (replaces the retired Fly service)

**New tables:**
- `daily_score_distribution` (date, org_id, avg_score, min, max, p50, p90, p95, total_contacts)
- `engagement_cohorts` (date, org_id, grade, count, avg_open_rate, avg_click_rate)
- `score_trends` (org_id, contact_id, date, score_value)
- `enrichment_metrics` (date, org_id, total_enriched, success_rate, avg_cost, avg_freshness)

**Step 1: Commit**

```bash
git add packages/domains/analytics-domain/ workers/analytics/
git commit -m "feat: add scoring and enrichment analytics aggregations (Phase 18, Task 162)"
```

---

### Task 163: Add enrichment provider connections to Integrations domain

**Files:**
- Modify: `packages/domains/integrations-domain/drizzle/schema.ts` — add enrichment provider types to connection_type enum
- Modify: `workers/integrations/src/interface/connection-routes.ts` — support creating enrichment provider connections
- Add sync of lead_score to Salesforce/HubSpot in CRM sync jobs

**Step 1: Commit**

```bash
git add packages/domains/integrations-domain/ workers/integrations/
git commit -m "feat: add enrichment provider connections to Integrations (Phase 18, Task 163)"
```

---

### Task 164: Wire up cross-context event handlers in Gateway

**Files:**
- Modify: `workers/gateway/src/app.tsx` — register event routing for new events
- Create: `workers/gateway/src/events/lead-intelligence-events.ts` — route LeadEnrichedEvent to Scoring context
- Create: `workers/gateway/src/events/scoring-events.ts` — route LeadScoredEvent to Journey, Campaign, RevOps
- Create: `workers/gateway/src/events/revops-events.ts` — route DealStageChangedEvent to workflows

Event flow:
1. `LeadEnrichedEvent` → triggers scoring recalculation
2. `LeadScoredEvent` → evaluates journey triggers, updates CRM contact fields
3. `IntentSignalDetectedEvent` → evaluates journey triggers, creates signal alerts
4. `ScoreThresholdCrossedEvent` → routes to RevOps for lead routing
5. `DealStageChangedEvent` → evaluates RevOps workflows

**Step 1: Commit**

```bash
git add workers/gateway/
git commit -m "feat: wire cross-context event handlers in Gateway (Phase 18, Task 164)"
```

---

### Task 165: Add HTMX views for Lead Intelligence, Scoring, and RevOps

**Files:**
- Create: `workers/lead-intelligence/src/views/` — provider list, enrichment history, waterfall config, health dashboard
- Create: `workers/scoring/src/views/` — score detail, signal list, alert dashboard, leaderboard, score history chart
- Create: `workers/revops/src/views/` — deal pipeline board, forecast chart, routing config, sequence builder, research insights, prospect list

Follow the JSX/HTMX pattern from `workers/crm/src/views/`.

**Step 1: Commit**

```bash
git add workers/lead-intelligence/src/views/ workers/scoring/src/views/ workers/revops/src/views/
git commit -m "feat: add HTMX views for new contexts (Phase 18, Task 165)"
```

---

## Phase 19: Database Migrations & Testing (Tasks 166-172)

### Task 166: Generate and apply Drizzle migrations for all new schemas

**Files:**
- Generate: `packages/domains/lead-intelligence-domain/drizzle/migrations/`
- Generate: `packages/domains/scoring-domain/drizzle/migrations/`
- Generate: `packages/domains/revops-domain/drizzle/migrations/`
- Modify: `scripts/init-schemas.ts` — add lead_intelligence, scoring, revops schemas
- Modify: `scripts/migrate-all.ts` — include new domain migrations
- Modify: `scripts/apply-rls.ts` — add RLS policies for all new tables

**Step 1: Generate migrations**

```bash
cd packages/domains/lead-intelligence-domain && pnpm db:generate
cd packages/domains/scoring-domain && pnpm db:generate
cd packages/domains/revops-domain && pnpm db:generate
```

**Step 2: Update init-schemas.ts**

Add `CREATE SCHEMA IF NOT EXISTS lead_intelligence`, `scoring`, `revops`.

**Step 3: Update apply-rls.ts**

For every new table, add:
```sql
ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {schema}.{table}
  USING (organization_id = current_setting('app.organization_id')::uuid);
```

**Step 4: Run migrations**

```bash
cd /Users/lsendel/Projects/mauntic3 && pnpm run db:migrate
```

**Step 5: Commit**

```bash
git add packages/domains/*/drizzle/migrations/ scripts/
git commit -m "feat: generate migrations and RLS for new schemas (Phase 19, Task 166)"
```

---

### Task 167: Add seed data for Lead Intelligence

**Files:**
- Modify: `scripts/seed.ts` — add sample enrichment providers (Clearbit, Apollo, Hunter), waterfall configs, enrichment jobs

**Step 1: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add Lead Intelligence seed data (Phase 19, Task 167)"
```

---

### Task 168: Add seed data for Scoring & Intent

**Files:**
- Modify: `scripts/seed.ts` — add sample signal configs (all 44 types), scoring configs (default weights), sample lead scores, intent signals

**Step 1: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add Scoring & Intent seed data (Phase 19, Task 168)"
```

---

### Task 169: Add seed data for Revenue Operations

**Files:**
- Modify: `scripts/seed.ts` — add sample deals (across stages), activities, routing rules, sequences, workflows

**Step 1: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add Revenue Operations seed data (Phase 19, Task 169)"
```

---

### Task 170: Write integration tests for enrichment waterfall

**Files:**
- Create: `tests/enrichment/enrichment-waterfall.test.ts`

Test scenarios:
- Successful enrichment with first provider
- Fallback to second provider when first fails
- Circuit breaker opens after 5 failures
- Cache hit skips provider calls
- Cost guard stops enrichment when budget exceeded
- Batch enrichment processes multiple contacts

**Step 1: Commit**

```bash
git add tests/enrichment/
git commit -m "test: add enrichment waterfall integration tests (Phase 19, Task 170)"
```

---

### Task 171: Write integration tests for scoring and intent signals

**Files:**
- Create: `tests/scoring/scoring-engine.test.ts`
- Create: `tests/scoring/signal-detection.test.ts`

Test scenarios:
- Rule-based scoring with default weights
- Score grade calculation (A/B/C/D/F)
- Signal detection from page visit events
- Signal time-decay calculation
- Signal alert generation with correct SLA
- Score threshold crossing detection
- Leaderboard ranking

**Step 1: Commit**

```bash
git add tests/scoring/
git commit -m "test: add scoring and intent signal integration tests (Phase 19, Task 171)"
```

---

### Task 172: Write integration tests for revenue operations

**Files:**
- Create: `tests/revops/deal-pipeline.test.ts`
- Create: `tests/revops/lead-routing.test.ts`
- Create: `tests/revops/sdr-agent.test.ts`

Test scenarios:
- Deal stage transitions with validation
- Forecast weighted calculation
- Round-robin lead routing
- Territory-based routing
- SDR prospect qualification
- Sequence enrollment and step execution
- Workflow trigger evaluation

**Step 1: Commit**

```bash
git add tests/revops/
git commit -m "test: add revenue operations integration tests (Phase 19, Task 172)"
```

---

## Phase 20: Deployment & Documentation (Tasks 173-176)

### Task 173: Add Wrangler configs for new workers

**Files:**
- Modify: `workers/lead-intelligence/wrangler.toml` — add bindings (DATABASE_URL via Hyperdrive, queues, KV)
- Modify: `workers/scoring/wrangler.toml` — same bindings
- Modify: `workers/revops/wrangler.toml` — same bindings

**Step 1: Commit**

```bash
git add workers/*/wrangler.toml
git commit -m "feat: add Wrangler configs for new workers (Phase 20, Task 173)"
```

---

### Task 174: Add Fly.io configs for new services

**Files:**
- Modify: `services/enrichment-engine/fly.toml` — memory, CPU, env vars, health checks
- (Superseded) `services/scoring-engine/fly.toml` — scoring now runs on Cloudflare Queues; no Fly config required
- Modify: `services/revops-engine/fly.toml` — same
- Modify: `docker-compose.dev.yml` — add new services for local dev (exclude scoring engine)

**Step 1: Commit**

```bash
git add services/*/fly.toml docker-compose.dev.yml
git commit -m "feat: add Fly.io configs for new services (Phase 20, Task 174)"
```

---

### Task 175: Update Gateway routing for new workers

**Files:**
- Modify: `workers/gateway/src/app.tsx` — add route prefixes for lead-intelligence, scoring, revops workers
- Modify: `workers/gateway/wrangler.toml` — add service bindings for new workers

Route mapping:
- `/api/v1/lead-intelligence/*` → lead-intelligence worker
- `/api/v1/scoring/*` → scoring worker
- `/api/v1/revops/*` → revops worker
- `/lead-intelligence/*` → lead-intelligence worker (HTMX views)
- `/scoring/*` → scoring worker (HTMX views)
- `/revops/*` → revops worker (HTMX views)

**Step 1: Commit**

```bash
git add workers/gateway/
git commit -m "feat: update Gateway routing for new workers (Phase 20, Task 175)"
```

---

### Task 176: Update CI/CD and turbo pipeline

**Files:**
- Modify: `turbo.json` — verify new packages are included in build graph
- Modify: `.github/workflows/` — add deploy steps for new workers and services
- Verify: `pnpm-workspace.yaml` includes new packages automatically via glob

**Step 1: Verify workspace detection**

```bash
pnpm ls --depth 0 --filter "@mauntic/*"
```

All new packages should appear: `@mauntic/lead-intelligence-domain`, `@mauntic/scoring-domain`, `@mauntic/revops-domain`.

**Step 2: Run full build**

```bash
pnpm turbo build
```

**Step 3: Run all tests**

```bash
pnpm turbo test
```

**Step 4: Commit**

```bash
git add turbo.json .github/
git commit -m "feat: update CI/CD for new contexts (Phase 20, Task 176)"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 13 | 119-126 | Lead Intelligence domain, schema, entities, contract |
| 14 | 127-134 | Lead Intelligence worker, service, 6 provider adapters, CRM columns |
| 15 | 135-142 | Scoring & Intent domain, schema, entities, services, contract |
| 16 | 143-150 | Revenue Operations domain, schema, entities, AI agents, workflow |
| 17 | 151-158 | Revenue Operations worker, service, LLM adapters, agent execution |
| 18 | 159-165 | Cross-context integration (Journey triggers, Campaign filters, Analytics, Gateway events, HTMX views) |
| 19 | 166-172 | Database migrations, RLS, seed data, integration tests |
| 20 | 173-176 | Deployment configs, Gateway routing, CI/CD |

**Total: 58 tasks across 8 phases (Tasks 119-176)**
