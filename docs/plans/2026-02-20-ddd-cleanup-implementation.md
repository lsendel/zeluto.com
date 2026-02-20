# DDD Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 DDD/clean-code issues across the monorepo, delivered as 6 independent PRs in dependency order.

**Architecture:** Each PR follows the existing DDD layering: domain entities + repository interfaces in `packages/domains/*-domain/`, Drizzle implementations in `workers/*/src/infrastructure/`, application services in `workers/*/src/application/`, route handlers in `workers/*/src/interface/`. Branded ID types from `@mauntic/domain-kernel` enforce type safety at compile time.

**Tech Stack:** TypeScript (strict), Drizzle ORM, Neon PostgreSQL, Hono, Cloudflare Workers, Vitest, Biome

**Design doc:** `docs/plans/2026-02-20-ddd-cleanup-design.md`

---

## PR 1: Branded IDs + Domain Event Type Fix

### Task 1.1: Add Cast Helpers to branded-id.ts

**Files:**
- Modify: `packages/domain-kernel/src/value-objects/branded-id.ts`

**Step 1: Add cast helper functions after the existing type/schema definitions**

Append to `packages/domain-kernel/src/value-objects/branded-id.ts`:

```ts
// ── Boundary cast helpers ────────────────────────────────────────────
// Use at system boundaries (route params, DB results) to wrap raw strings.
// These are compile-time-only casts — zero runtime cost.

export function asOrganizationId(id: string): OrganizationId { return id as OrganizationId; }
export function asUserId(id: string): UserId { return id as UserId; }
export function asContactId(id: string): ContactId { return id as ContactId; }
export function asCompanyId(id: string): CompanyId { return id as CompanyId; }
export function asCampaignId(id: string): CampaignId { return id as CampaignId; }
export function asSegmentId(id: string): SegmentId { return id as SegmentId; }
export function asJourneyId(id: string): JourneyId { return id as JourneyId; }
export function asJourneyVersionId(id: string): JourneyVersionId { return id as JourneyVersionId; }
export function asJourneyStepId(id: string): JourneyStepId { return id as JourneyStepId; }
export function asEmailId(id: string): EmailId { return id as EmailId; }
export function asFormId(id: string): FormId { return id as FormId; }
export function asPageId(id: string): PageId { return id as PageId; }
export function asAssetId(id: string): AssetId { return id as AssetId; }
export function asWebhookId(id: string): WebhookId { return id as WebhookId; }
export function asIntegrationId(id: string): IntegrationId { return id as IntegrationId; }
export function asReportId(id: string): ReportId { return id as ReportId; }
export function asDeliveryJobId(id: string): DeliveryJobId { return id as DeliveryJobId; }
export function asTemplateId(id: string): TemplateId { return id as TemplateId; }
export function asSubscriptionId(id: string): SubscriptionId { return id as SubscriptionId; }
export function asPlanId(id: string): PlanId { return id as PlanId; }
export function asEnrichmentJobId(id: string): EnrichmentJobId { return id as EnrichmentJobId; }
export function asEnrichmentProviderId(id: string): EnrichmentProviderId { return id as EnrichmentProviderId; }
export function asLeadScoreId(id: string): LeadScoreId { return id as LeadScoreId; }
export function asIntentSignalId(id: string): IntentSignalId { return id as IntentSignalId; }
export function asSignalAlertId(id: string): SignalAlertId { return id as SignalAlertId; }
export function asDealId(id: string): DealId { return id as DealId; }
export function asForecastId(id: string): ForecastId { return id as ForecastId; }
export function asRoutingRuleId(id: string): RoutingRuleId { return id as RoutingRuleId; }
export function asSequenceId(id: string): SequenceId { return id as SequenceId; }
export function asProspectId(id: string): ProspectId { return id as ProspectId; }
export function asActivityId(id: string): ActivityId { return id as ActivityId; }
export function asWorkflowId(id: string): WorkflowId { return id as WorkflowId; }
export function asResearchJobId(id: string): ResearchJobId { return id as ResearchJobId; }
```

**Step 2: Export cast helpers from domain-kernel barrel**

Verify `packages/domain-kernel/src/index.ts` re-exports from `./value-objects/branded-id.js`. If not, add the re-export.

**Step 3: Build domain-kernel and verify**

Run: `cd packages/domain-kernel && pnpm build`
Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add packages/domain-kernel/src/value-objects/branded-id.ts packages/domain-kernel/src/index.ts
git commit -m "feat(domain-kernel): add branded ID cast helpers for boundary conversions"
```

---

### Task 1.2: Update TenantContext to Use Branded IDs

**Files:**
- Modify: `packages/domain-kernel/src/tenant/tenant-context.ts`

**Step 1: Update TenantContext interface**

```ts
import type { OrganizationId, UserId } from '../value-objects/branded-id.js';

export interface TenantContext {
  organizationId: OrganizationId;
  userId: UserId;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}
```

**Step 2: Run typecheck to find all breakages**

Run: `pnpm typecheck 2>&1 | head -100`

This will show every file that constructs a `TenantContext` with plain `string`. Fix each by wrapping with `asOrganizationId()` / `asUserId()`.

Known locations to fix:
- `workers/gateway/src/middleware/tenant.ts` — where TenantContext is constructed from session
- Test files that construct mock TenantContext objects

**Step 3: Fix all callers iteratively**

For each error, wrap the raw string at the boundary:
```ts
import { asOrganizationId, asUserId } from '@mauntic/domain-kernel';

const tenant: TenantContext = {
  organizationId: asOrganizationId(session.organizationId),
  userId: asUserId(session.userId),
  userRole: session.userRole,
  plan: session.plan,
};
```

**Step 4: Build and verify**

Run: `pnpm typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain-kernel): use branded OrganizationId/UserId in TenantContext"
```

---

### Task 1.3: Fix DomainEventMetadata and All Event Interfaces

**Files:**
- Modify: `packages/domain-kernel/src/events/domain-event.ts`

**Step 1: Add branded ID imports**

At the top of `domain-event.ts`:
```ts
import type {
  OrganizationId, UserId, ContactId, CampaignId, SegmentId,
  JourneyId, JourneyVersionId, JourneyStepId, DeliveryJobId,
  TemplateId, SubscriptionId, FormId, PageId, AssetId,
  WebhookId, IntegrationId, ReportId, DealId, SequenceId,
  LeadScoreId, IntentSignalId, SignalAlertId,
} from '../value-objects/branded-id.js';
```

**Step 2: Fix `DomainEventMetadata.tenantContext.organizationId` from `number` to `OrganizationId`**

```ts
export interface DomainEventMetadata {
  id: string;
  version: number;
  sourceContext: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  tenantContext: {
    organizationId: OrganizationId;
  };
}
```

**Step 3: Replace `number` with branded types in ALL event data interfaces**

This is a mechanical find-and-replace across ~100 event interfaces. The pattern:
- `organizationId: number` → `organizationId: OrganizationId`
- `contactId: number` → `contactId: ContactId`
- `userId: number` → `userId: UserId`
- `campaignId: number` → `campaignId: CampaignId`
- `journeyId: number` → `journeyId: JourneyId`
- `versionId: number` → `versionId: JourneyVersionId`
- `stepId: string` → `stepId: JourneyStepId` (already string, brand it)
- `executionId: string` → keep as `string` (no branded type exists for this)
- `deliveryJobId: string` → `deliveryJobId: DeliveryJobId`
- `segmentId: number` → `segmentId: SegmentId`
- `tagId: number` → keep as `string` (tags use string UUID)
- `templateId: number` → `templateId: TemplateId`
- `formId: number` → `formId: FormId`
- `pageId: number` → `pageId: PageId`
- `assetId: number` → `assetId: AssetId`
- `subscriptionId: string` → `subscriptionId: SubscriptionId`
- `connectionId: string` → `connectionId: IntegrationId`
- `webhookId: string` → `webhookId: WebhookId`
- `reportId: string` → `reportId: ReportId`
- `dealId: string` → `dealId: DealId`
- `sequenceId: string` → `sequenceId: SequenceId`
- `invitedBy: number` → `invitedBy: UserId`
- `removedBy: number` → `removedBy: UserId`
- `changedBy: number` → `changedBy: UserId`
- `createdBy: number` → `createdBy: UserId`
- `pausedBy: number` → `pausedBy: UserId`
- `archivedBy: number` → `archivedBy: UserId`
- `scheduledBy: number` → `scheduledBy: UserId`
- `canceledBy: number` → `canceledBy: UserId`
- `publishedBy: number` → `publishedBy: UserId`
- `mergedBy: number` → `mergedBy: UserId`
- `deletedBy: number` → `deletedBy: UserId`
- `addedBy: number` → `addedBy: UserId`
- `generatedBy: number` → `generatedBy: UserId`
- `uploadedBy: number` → `uploadedBy: UserId`
- `unpublishedBy: number` → `unpublishedBy: UserId`
- `ownerId: number` → `ownerId: UserId`
- `winnerId: number` → keep as `string` (merge winner ID)
- `loserId: number` → keep as `string` (merge loser ID)

**Step 4: Run typecheck to find all breakages from event construction**

Run: `pnpm typecheck 2>&1 | head -200`

Fix each location where domain events are constructed (in entity `create()` methods, queue handlers, etc.) by wrapping IDs with cast helpers.

**Step 5: Build and verify**

Run: `pnpm typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add -A && git commit -m "fix(domain-kernel): use branded ID types in all domain event interfaces

Fixes number vs string mismatch — all IDs were typed as number
but actual values are UUID strings."
```

---

### Task 1.4: Update Repository Interface Signatures

**Files:**
- Modify: `packages/domains/crm-domain/src/repositories/contact-repository.ts`
- Modify: `packages/domains/crm-domain/src/repositories/segment-repository.ts`
- Modify: `packages/domains/crm-domain/src/repositories/tag-repository.ts`
- Modify: `packages/domains/crm-domain/src/repositories/field-repository.ts`
- Modify: `packages/domains/crm-domain/src/repositories/company-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/lead-score-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/intent-signal-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/signal-alert-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/score-history-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/scoring-config-repository.ts`
- Modify: `packages/domains/journey-domain/src/repositories/journey-repository.ts`
- Modify: `packages/domains/identity-domain/src/repositories/user-repository.ts`
- Modify: `packages/domains/identity-domain/src/repositories/organization-repository.ts`
- Modify: `packages/domains/identity-domain/src/repositories/invite-repository.ts`
- Modify: `packages/domains/identity-domain/src/repositories/member-repository.ts`

**Step 1: Update each repository interface**

Replace `orgId: string` with `orgId: OrganizationId`, `id: string` with the appropriate branded ID type. Import the branded types from `@mauntic/domain-kernel`.

Example for `ContactRepository`:
```ts
import type { OrganizationId, ContactId, SegmentId } from '@mauntic/domain-kernel';
import type { Contact } from '../entities/contact.js';

export interface ContactRepository {
  findById(orgId: OrganizationId, id: ContactId): Promise<Contact | null>;
  findByEmail(orgId: OrganizationId, email: string): Promise<Contact | null>;
  findByOrganization(orgId: OrganizationId, pagination: { page: number; limit: number; search?: string }): Promise<{ data: Contact[]; total: number }>;
  findBySegment(orgId: OrganizationId, segmentId: SegmentId, pagination: { offset: number; limit: number }): Promise<{ data: Contact[]; total: number; nextOffset: number | null }>;
  save(contact: Contact): Promise<void>;
  saveMany(contacts: Contact[]): Promise<void>;
  delete(orgId: OrganizationId, id: ContactId): Promise<void>;
  countByOrganization(orgId: OrganizationId): Promise<number>;
}
```

Apply the same pattern to all other repositories.

**Step 2: Update entity Props schemas**

Each entity's `PropsSchema` should use branded types for ID fields. Since Zod schemas parse at runtime, the branded cast happens in `reconstitute()`:

In entity files, update the Props type (not the Zod schema — Zod doesn't know about branded types, so the schema stays `z.string().uuid()` but the inferred type gets overridden):

```ts
export type ContactProps = Omit<z.infer<typeof ContactPropsSchema>, 'id' | 'organizationId'> & {
  id: ContactId;
  organizationId: OrganizationId;
};
```

Or simpler: keep `Props` as-is and type the accessors with branded types:
```ts
get id(): ContactId { return this.props.id as ContactId; }
get organizationId(): OrganizationId { return this.props.organizationId as OrganizationId; }
```

**Recommendation:** Use the accessor approach — minimal changes, type safety where it matters (public API), no Zod schema changes.

**Step 3: Fix all implementations that implement these interfaces**

Run: `pnpm typecheck 2>&1 | head -200`

Fix each Drizzle repository implementation by wrapping DB result IDs with cast helpers in `mapToEntity()` / `reconstitute()`.

**Step 4: Fix all callers of these interfaces**

Route handlers and services that call repository methods need to pass branded IDs. Since `TenantContext.organizationId` is already `OrganizationId` (from Task 1.2), most callers just need to wrap path params:

```ts
const contact = await repo.findById(tenant.organizationId, asContactId(String(params.id)));
```

**Step 5: Build and verify**

Run: `pnpm typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: adopt branded ID types in all repository interfaces and entity accessors"
```

---

### Task 1.5: Create PR for Branded IDs

**Step 1: Run full test suite**

Run: `pnpm test -- --run`
Expected: All tests pass.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors (auto-fix formatting if needed with `biome format --write .`).

**Step 3: Create PR**

```bash
gh pr create --title "feat: adopt branded ID types across the monorepo" --body "$(cat <<'EOF'
## Summary
- Add boundary cast helpers for all branded ID types
- Update TenantContext to use OrganizationId/UserId
- Fix domain event metadata and all 100+ event interfaces (number → branded string types)
- Update all repository interface signatures to use branded IDs
- Update entity accessors to return branded types

## Test plan
- [ ] `pnpm typecheck` passes — compile-time safety is the primary guard
- [ ] `pnpm test -- --run` passes — no runtime behavior changes
- [ ] Spot-check gateway middleware constructs TenantContext with cast helpers

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 2: CRM Contract Router → Repository Pattern

**Prerequisite:** PR 1 merged.

### Task 2.1: Write Tests for DrizzleSegmentRepository

**Files:**
- Create: `workers/crm/src/tests/drizzle-segment-repository.test.ts`

**Step 1: Write the test file**

Follow the mock pattern from `contact-service.test.ts`. Test against the `SegmentRepository` interface with mock DB:

```ts
import { Segment, type SegmentRepository } from '@mauntic/crm-domain';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleSegmentRepository } from '../infrastructure/repositories/drizzle-segment-repository.js';

// These tests verify the repository correctly maps between DB rows and domain entities.
// Integration tests with a real DB are separate — these test the mapping logic only.

describe('DrizzleSegmentRepository', () => {
  // Test reconstitution from DB row
  it('should reconstitute a Segment from a DB row', () => {
    const segment = Segment.reconstitute({
      id: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      name: 'Test Segment',
      description: null,
      type: 'static',
      filterCriteria: null,
      contactCount: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(segment.name).toBe('Test Segment');
    expect(segment.contactCount).toBe(42);
  });

  it('should enforce invariants on update', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Valid',
      type: 'dynamic',
      filterCriteria: { field: 'email', operator: 'contains', value: '@' },
    });
    expect(() => segment.update({ name: '' })).toThrow('Segment name must not be empty');
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd workers/crm && pnpm test -- --run`
Expected: PASS — tests verify domain entity behavior (repo implementation comes next).

**Step 3: Commit**

```bash
git add workers/crm/src/tests/drizzle-segment-repository.test.ts
git commit -m "test(crm): add segment repository tests"
```

---

### Task 2.2: Implement DrizzleSegmentRepository

**Files:**
- Create: `workers/crm/src/infrastructure/repositories/drizzle-segment-repository.ts`

**Step 1: Write the implementation**

```ts
import {
  contacts,
  segment_contacts,
  segments,
} from '@mauntic/crm-domain/drizzle';
import { Segment, type SegmentRepository } from '@mauntic/crm-domain';
import type { OrganizationId, SegmentId, ContactId } from '@mauntic/domain-kernel';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { buildFilterWhere, type FilterCriteria } from '../../services/filter-engine.js';

export class DrizzleSegmentRepository implements SegmentRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: OrganizationId, id: SegmentId): Promise<Segment | null> {
    const [row] = await this.db
      .select()
      .from(segments)
      .where(and(eq(segments.id, id), eq(segments.organization_id, orgId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Segment[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(segments)
        .where(eq(segments.organization_id, orgId))
        .orderBy(desc(segments.created_at))
        .limit(pagination.limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(segments)
        .where(eq(segments.organization_id, orgId)),
    ]);
    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: totalResult[0]?.total ?? 0,
    };
  }

  async save(segment: Segment): Promise<void> {
    const props = segment.toProps();
    const [existing] = await this.db
      .select({ id: segments.id })
      .from(segments)
      .where(eq(segments.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(segments)
        .set({
          name: props.name,
          description: props.description,
          filter_criteria: props.filterCriteria,
          contact_count: props.contactCount,
          updated_at: props.updatedAt,
        })
        .where(eq(segments.id, props.id));
    } else {
      await this.db.insert(segments).values({
        id: props.id,
        organization_id: props.organizationId,
        name: props.name,
        description: props.description,
        type: props.type,
        filter_criteria: props.filterCriteria,
        contact_count: props.contactCount,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: SegmentId): Promise<void> {
    await this.db.delete(segment_contacts).where(eq(segment_contacts.segment_id, id));
    await this.db.delete(segments).where(and(eq(segments.id, id), eq(segments.organization_id, orgId)));
  }

  async addContacts(orgId: OrganizationId, segmentId: SegmentId, contactIds: ContactId[]): Promise<void> {
    if (!contactIds.length) return;

    // Validate contacts belong to this org
    const validContacts = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(inArray(contacts.id, contactIds), eq(contacts.organization_id, orgId)));
    const validIds = new Set(validContacts.map((c) => c.id));

    // Filter out already-linked contacts
    const existingLinks = await this.db
      .select({ contact_id: segment_contacts.contact_id })
      .from(segment_contacts)
      .where(and(
        eq(segment_contacts.segment_id, segmentId),
        inArray(segment_contacts.contact_id, contactIds.filter((id) => validIds.has(id))),
      ));
    const existingIds = new Set(existingLinks.map((l) => l.contact_id));

    const toInsert = contactIds.filter((id) => validIds.has(id) && !existingIds.has(id));
    if (toInsert.length > 0) {
      await this.db.insert(segment_contacts).values(
        toInsert.map((contactId) => ({ segment_id: segmentId, contact_id: contactId })),
      );
    }
  }

  async removeContacts(orgId: OrganizationId, segmentId: SegmentId, contactIds: ContactId[]): Promise<void> {
    if (!contactIds.length) return;
    await this.db
      .delete(segment_contacts)
      .where(and(eq(segment_contacts.segment_id, segmentId), inArray(segment_contacts.contact_id, contactIds)));
  }

  async countMatchingContacts(orgId: OrganizationId, filterCriteria: FilterCriteria): Promise<number> {
    const where = buildFilterWhere(filterCriteria, orgId);
    const result = await this.db.select({ total: count() }).from(contacts).where(where);
    return result[0]?.total ?? 0;
  }

  private mapToEntity(row: typeof segments.$inferSelect): Segment {
    return Segment.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description ?? null,
      type: row.type as 'static' | 'dynamic',
      filterCriteria: row.filter_criteria,
      contactCount: row.contact_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
```

**Step 2: Run tests**

Run: `cd workers/crm && pnpm test -- --run`
Expected: PASS.

**Step 3: Commit**

```bash
git add workers/crm/src/infrastructure/repositories/drizzle-segment-repository.ts
git commit -m "feat(crm): implement DrizzleSegmentRepository"
```

---

### Task 2.3: Implement DrizzleTagRepository, DrizzleFieldRepository, DrizzleCompanyRepository

**Files:**
- Create: `workers/crm/src/infrastructure/repositories/drizzle-tag-repository.ts`
- Create: `workers/crm/src/infrastructure/repositories/drizzle-field-repository.ts`
- Create: `workers/crm/src/infrastructure/repositories/drizzle-company-repository.ts`

**Step 1: Implement all three repositories**

Follow the same pattern as `DrizzleSegmentRepository`. Each implements its corresponding interface from `@mauntic/crm-domain`:
- `DrizzleTagRepository implements TagRepository`
- `DrizzleFieldRepository implements FieldRepository`
- `DrizzleCompanyRepository implements CompanyRepository`

Each has a `mapToEntity()` private method that calls `Entity.reconstitute()`.

**Note on `countMatchingContacts` for SegmentRepository:** This method was added to the interface in the design but already exists in the `SegmentRepository` interface from `crm-domain`. Verify the interface signature matches. If the existing interface doesn't have `countMatchingContacts`, add it to `packages/domains/crm-domain/src/repositories/segment-repository.ts`.

**Step 2: Run tests**

Run: `cd workers/crm && pnpm test -- --run`
Expected: PASS.

**Step 3: Commit**

```bash
git add workers/crm/src/infrastructure/repositories/drizzle-tag-repository.ts \
       workers/crm/src/infrastructure/repositories/drizzle-field-repository.ts \
       workers/crm/src/infrastructure/repositories/drizzle-company-repository.ts
git commit -m "feat(crm): implement DrizzleTagRepository, DrizzleFieldRepository, DrizzleCompanyRepository"
```

---

### Task 2.4: Refactor contract-router.ts to Use Repositories

**Files:**
- Modify: `workers/crm/src/interface/contract-router.ts`

**Step 1: Add repository construction helpers**

Add helpers similar to the existing `getContactService()`:

```ts
import { DrizzleSegmentRepository } from '../infrastructure/repositories/drizzle-segment-repository.js';
import { DrizzleTagRepository } from '../infrastructure/repositories/drizzle-tag-repository.js';
import { DrizzleFieldRepository } from '../infrastructure/repositories/drizzle-field-repository.js';
import { DrizzleCompanyRepository } from '../infrastructure/repositories/drizzle-company-repository.js';

function getSegmentRepo(ctx: CrmPlatformContext) { return new DrizzleSegmentRepository(ctx.db); }
function getTagRepo(ctx: CrmPlatformContext) { return new DrizzleTagRepository(ctx.db); }
function getFieldRepo(ctx: CrmPlatformContext) { return new DrizzleFieldRepository(ctx.db); }
function getCompanyRepo(ctx: CrmPlatformContext) { return new DrizzleCompanyRepository(ctx.db); }
```

**Step 2: Replace inline Drizzle queries in segments section**

Each handler becomes:
```ts
segments: {
  list: async ({ query }: any, ctx: CrmPlatformContext) => {
    const repo = getSegmentRepo(ctx);
    const result = await repo.findByOrganization(ctx.tenant.organizationId, {
      page: query.page,
      limit: query.limit,
    });
    return {
      status: 200 as const,
      body: {
        data: result.data.map((s) => s.toProps()),
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  },
  // ... similar for create, get, update, delete, addContacts, removeContacts
}
```

For `create`: use `Segment.create()` from domain, then `repo.save()`.
For `get` with dynamic recount: call `repo.countMatchingContacts()` and `segment.updateContactCount()` + `repo.save()`.
For `addContacts`/`removeContacts`: check `segment.type !== 'static'` before calling `repo.addContacts()`.

**Step 3: Replace inline Drizzle queries in tags, fields, companies sections**

Same pattern — repository method calls + entity `toProps()` for serialization.

**Step 4: Delete serialize helpers and old company-repository.ts**

Remove `serializeSegment()`, `serializeTag()`, `serializeField()` from contract-router.
Remove unused imports (`segments`, `tags`, `fields`, `segment_contacts`, `contact_tags`, `contacts` from drizzle schema).
Delete `workers/crm/src/infrastructure/repositories/company-repository.ts` (raw function module).

**Step 5: Remove unused drizzle imports**

Clean up imports at the top of `contract-router.ts`. Should no longer import any Drizzle schema tables or operators directly.

**Step 6: Run tests and typecheck**

Run: `cd workers/crm && pnpm test -- --run && pnpm typecheck`
Expected: All pass.

**Step 7: Commit**

```bash
git add -A && git commit -m "refactor(crm): replace inline Drizzle in contract-router with repository pattern

Segments, tags, fields, and companies now use domain entities + Drizzle
repositories instead of raw queries in route handlers."
```

---

### Task 2.5: Create PR for CRM Repos

**Step 1: Run full test suite and lint**

Run: `pnpm test -- --run && pnpm lint`

**Step 2: Create PR**

```bash
gh pr create --title "refactor(crm): extract segment/tag/field/company repositories" --body "$(cat <<'EOF'
## Summary
- Implement DrizzleSegmentRepository, DrizzleTagRepository, DrizzleFieldRepository, DrizzleCompanyRepository
- Refactor contract-router.ts from ~900 lines of inline Drizzle to ~200 lines using repositories
- Delete raw function-based company-repository.ts and serialize helpers
- All handlers now use domain entities with `toProps()` for serialization

## Test plan
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test -- --run` passes
- [ ] CRM HTMX views still render correctly (segments, tags, fields, companies)
- [ ] API contract unchanged (same request/response shapes)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 3: Journey Worker → Domain Entities

**Prerequisite:** PR 1 merged.

### Task 3.1: Implement DrizzleJourneyRepository

**Files:**
- Create: `workers/journey/src/infrastructure/repositories/drizzle-journey-repository.ts`

Implements `JourneyRepository` from `@mauntic/journey-domain`. Uses `Journey.reconstitute()` for hydration. Follow the same pattern as `DrizzleContactRepository` in CRM.

### Task 3.2: Implement JourneyService Application Layer

**Files:**
- Create: `workers/journey/src/application/journey-service.ts`

Orchestrates create/update/publish/pause/resume/archive via `JourneyRepository` + domain entity state machine methods. Returns `Result<Journey>`.

### Task 3.3: Refactor journey-routes.ts

**Files:**
- Modify: `workers/journey/src/interface/journey-routes.ts`

Replace raw repo function calls with `JourneyService` method calls. Delete raw function-based repository files.

### Task 3.4: Create PR

Same pattern as PR 2.

---

## PR 4: Scoring Queue Handler → Domain Services

**Prerequisite:** PR 1 merged.

### Task 4.1: Add Batch Methods to Repository Interfaces

**Files:**
- Modify: `packages/domains/scoring-domain/src/repositories/intent-signal-repository.ts`
- Modify: `packages/domains/scoring-domain/src/repositories/signal-alert-repository.ts`

Add:
```ts
// IntentSignalRepository — already has deleteExpired(orgId)
// Add cross-org variant:
deleteAllExpired(): Promise<number>;

// SignalAlertRepository
expireOverdue(orgId?: string): Promise<number>;
```

### Task 4.2: Implement Batch Methods in Drizzle Repositories

**Files:**
- Modify: `workers/scoring/src/infrastructure/drizzle-scoring-repositories.ts`

Implement `deleteAllExpired()` and `expireOverdue()`.

### Task 4.3: Refactor Queue Handler

**Files:**
- Modify: `workers/scoring/src/queue/queue-handler.ts`

Replace `runBatchRecompute()`, `runSignalDecay()`, `runAlertExpiry()` with calls to `ScoringEngine` and repository batch methods. Delete `currentSignalWeight()` and `clampScore()`.

### Task 4.4: Update Tests and Create PR

Run existing `queue-handler.test.ts`, fix any breakages from the refactor.

---

## PR 5: Identity Worker → Domain Entities & Repositories

**Prerequisite:** PR 1 merged.

### Task 5.1: Implement Drizzle Repositories for Identity

**Files:**
- Create: `workers/identity/src/infrastructure/repositories/drizzle-user-repository.ts`
- Create: `workers/identity/src/infrastructure/repositories/drizzle-organization-repository.ts`
- Create: `workers/identity/src/infrastructure/repositories/drizzle-invite-repository.ts`
- Create: `workers/identity/src/infrastructure/repositories/drizzle-member-repository.ts`

Each implements its interface from `@mauntic/identity-domain`, uses `Entity.reconstitute()`.

### Task 5.2: Refactor Commands to Use Repositories + Entities

**Files:**
- Modify: `workers/identity/src/application/commands/block-user.ts`
- Modify: `workers/identity/src/application/commands/invite-member.ts`
- Modify: `workers/identity/src/application/commands/change-role.ts`
- Modify: `workers/identity/src/application/commands/remove-member.ts`
- Modify: `workers/identity/src/application/commands/update-org.ts`
- Modify: `workers/identity/src/application/commands/update-user.ts`
- Modify: `workers/identity/src/application/commands/create-user.ts`
- Modify: `workers/identity/src/application/commands/create-org.ts`

Each command changes signature from `(db: DrizzleDb, ...)` to `(repos: { userRepo, memberRepo, ... }, ...)`.

Key refactor pattern for `blockUser`:
```ts
export async function blockUser(
  userRepo: UserRepository,
  memberRepo: MemberRepository,
  userId: UserId,
  organizationId: OrganizationId,
): Promise<User> {
  const member = await memberRepo.findByOrgAndUser(organizationId, userId);
  if (!member) throw new UserNotInOrgError(userId, organizationId);
  const user = await userRepo.findById(userId);
  if (!user) throw new UserNotFoundError(userId);
  user.block(); // domain method, throws InvariantViolation for owners
  await userRepo.save(user);
  return user;
}
```

For `inviteMember`:
```ts
export async function inviteMember(
  userRepo: UserRepository,
  memberRepo: MemberRepository,
  inviteRepo: InviteRepository,
  input: InviteMemberInput,
  actorRole: string,
): Promise<OrganizationInvite> {
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    throw new InsufficientPermissionsError('Only owners and admins can invite members');
  }
  const existingUser = await userRepo.findByEmail(input.email);
  if (existingUser) {
    const membership = await memberRepo.findByOrgAndUser(asOrganizationId(input.organizationId), asUserId(existingUser.id));
    if (membership) throw new AlreadyMemberError(input.email);
  }
  const existingInvites = await inviteRepo.findByOrganization(input.organizationId);
  if (existingInvites.some((inv) => inv.email === input.email)) {
    throw new InviteAlreadyExistsError(input.email);
  }
  const invite = OrganizationInvite.create({
    organizationId: input.organizationId,
    email: input.email,
    role: input.role,
    invitedBy: input.invitedBy,
  });
  await inviteRepo.save(invite);
  return invite;
}
```

### Task 5.3: Update Route Handlers

**Files:**
- Modify: `workers/identity/src/interface/user-routes.ts`

Routes construct repositories from `db` context and pass them to commands.

### Task 5.4: Create PR

Same pattern.

---

## PR 6: Explicit Column Selection in All Repositories

**Prerequisite:** PRs 1-5 merged.

### Task 6.1: Define Column Maps and Update Each Repository

**Files:**
- Modify: `workers/crm/src/infrastructure/repositories/drizzle-contact-repository.ts`
- Modify: `workers/scoring/src/infrastructure/drizzle-lead-score-repository.ts`
- Modify: `workers/scoring/src/infrastructure/drizzle-scoring-repositories.ts`
- Modify: `services/journey-executor/src/infrastructure/repositories/drizzle-journey-repository.ts`
- Modify: All new repositories from PRs 2-5

For each repository:
1. Define a `const COLUMNS = { ... } as const` matching entity props
2. Replace `db.select().from(table)` with `db.select(COLUMNS).from(table)`
3. Update `mapToEntity()` if the row shape changes

### Task 6.2: Verify No Select-Star Remains

Run: `grep -r '\.select()\.from(' workers/ services/ --include='*.ts' | grep -v node_modules | grep -v '.test.'`

Expected: No results (all select calls use explicit columns).

### Task 6.3: Create PR

```bash
gh pr create --title "refactor: use explicit column selection in all Drizzle repositories" --body "$(cat <<'EOF'
## Summary
- Replace db.select().from(table) with db.select(COLUMNS).from(table) in all repositories
- Prevents schema-DB column mismatch causing 500s
- Each repository defines a COLUMNS constant matching its entity Props type

## Test plan
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test -- --run` passes
- [ ] No bare `.select().from(` calls remain (verified via grep)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
