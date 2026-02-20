# DDD Cleanup Design — 6 PRs

**Date:** 2026-02-20
**Status:** Draft

## Summary

Fix 6 DDD/clean-code issues across the monorepo, delivered as 6 independent PRs in dependency order.

---

## PR 1: Branded IDs + Domain Event Type Fix

**Goal:** Enforce type-safe ID handling across the codebase and fix the `number` vs `string` mismatch in all domain event interfaces.

### Changes

**1a. Add cast helpers to `domain-kernel`**

File: `packages/domain-kernel/src/value-objects/branded-id.ts`

Add unsafe cast helpers for boundary conversions (route params, DB results):

```ts
export function asOrganizationId(id: string): OrganizationId { return id as OrganizationId; }
export function asContactId(id: string): ContactId { return id as ContactId; }
export function asUserId(id: string): UserId { return id as UserId; }
// ... one per branded type
```

**1b. Update `TenantContext`**

File: `packages/domain-kernel/src/tenant/tenant-context.ts`

```ts
export interface TenantContext {
  organizationId: OrganizationId;
  userId: UserId;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}
```

**1c. Fix `DomainEventMetadata` and all event interfaces**

File: `packages/domain-kernel/src/events/domain-event.ts`

- Change `tenantContext.organizationId` from `number` to `OrganizationId`
- Change all event `data` fields from `number` to proper branded types:
  - `organizationId: number` → `organizationId: OrganizationId`
  - `contactId: number` → `contactId: ContactId`
  - `userId: number` → `userId: UserId`
  - `campaignId: number` → `campaignId: CampaignId`
  - etc.
- Some IDs are already `string` (e.g., `executionId: string`, `deliveryJobId: string`) — change those to their branded equivalents too

**1d. Update repository interface signatures**

Update all repository interfaces in `packages/domains/*/src/repositories/` to use branded IDs:

- `ContactRepository.findById(orgId: OrganizationId, id: ContactId)`
- `JourneyRepository.findById(orgId: OrganizationId, id: JourneyId)`
- `LeadScoreRepository.findByContact(orgId: OrganizationId, contactId: ContactId)`
- `UserRepository.findById(id: UserId)`
- `OrganizationRepository.findById(id: OrganizationId)`
- etc.

**1e. Update entity props to use branded IDs**

Update `ContactProps.organizationId` → `OrganizationId`, `ContactProps.id` → `ContactId`, etc. across all domain entity schemas.

**1f. Update callers at boundaries**

- Gateway middleware wraps raw strings: `asOrganizationId(session.organizationId)`
- Route handlers wrap path params: `asContactId(String(params.id))`
- Repository implementations wrap DB results: `asContactId(row.id)`

### Risk

This is a large cross-cutting change. The branded types are structurally compatible with `string` at runtime (zero runtime cost), so the risk is purely compile-time breakage, caught by `tsc`.

---

## PR 2: CRM Contract Router → Repository Pattern

**Goal:** Extract segments, tags, fields, and companies from inline Drizzle in `contract-router.ts` into proper repositories.

### New Domain Entities

File: `packages/domains/crm-domain/src/entities/`

- **`Segment`** — plain entity (not AggregateRoot, no domain events needed for now)
  - Props: `id: SegmentId`, `organizationId: OrganizationId`, `name`, `type: 'static' | 'dynamic'`, `filterCriteria`, `contactCount`, `createdAt`, `updatedAt`
  - Methods: `update({ name?, filterCriteria? })`, `updateContactCount(count)`
  - Invariant: cannot add/remove contacts to a dynamic segment (enforced via type check)

- **`Tag`** — plain entity
  - Props: `id: string`, `organizationId: OrganizationId`, `name`, `color`, `createdAt`
  - Factory validates name uniqueness is a caller concern (repo check)

- **`CustomField`** — plain entity
  - Props: `id: string`, `organizationId: OrganizationId`, `entityType`, `name`, `label`, `fieldType`, `options`, `isRequired`, `sortOrder`
  - Invariant: select/multiselect fields require non-empty `options`

- **`Company`** — plain entity
  - Props: `id: CompanyId`, `organizationId: OrganizationId`, `name`, `domain`, `industry`, `size`, `customFields`, `createdAt`, `updatedAt`
  - Methods: `update({ name?, domain?, industry?, size? })`

### New Repository Interfaces

File: `packages/domains/crm-domain/src/repositories/`

```ts
// segment-repository.ts
export interface SegmentRepository {
  findById(orgId: OrganizationId, id: SegmentId): Promise<Segment | null>;
  findByOrganization(orgId: OrganizationId, pagination: { page: number; limit: number }): Promise<{ data: Segment[]; total: number }>;
  save(segment: Segment): Promise<void>;
  delete(orgId: OrganizationId, id: SegmentId): Promise<void>;
  addContacts(orgId: OrganizationId, segmentId: SegmentId, contactIds: ContactId[]): Promise<number>;
  removeContacts(orgId: OrganizationId, segmentId: SegmentId, contactIds: ContactId[]): Promise<number>;
  countMatchingContacts(orgId: OrganizationId, filterCriteria: FilterCriteria): Promise<number>;
}

// tag-repository.ts
export interface TagRepository {
  findByOrganization(orgId: OrganizationId): Promise<Tag[]>;
  findByName(orgId: OrganizationId, name: string): Promise<Tag | null>;
  save(tag: Tag): Promise<void>;
  delete(orgId: OrganizationId, id: string): Promise<void>;
}

// custom-field-repository.ts
export interface CustomFieldRepository {
  findByOrganization(orgId: OrganizationId, entityType?: string): Promise<CustomField[]>;
  findByName(orgId: OrganizationId, entityType: string, name: string): Promise<CustomField | null>;
  save(field: CustomField): Promise<void>;
  delete(orgId: OrganizationId, id: string): Promise<void>;
}

// company-repository.ts
export interface CompanyRepository {
  findById(orgId: OrganizationId, id: CompanyId): Promise<Company | null>;
  findByOrganization(orgId: OrganizationId, pagination: { page: number; limit: number; search?: string }): Promise<{ data: Company[]; total: number }>;
  save(company: Company): Promise<void>;
  delete(orgId: OrganizationId, id: CompanyId): Promise<void>;
}
```

### New Drizzle Implementations

File: `workers/crm/src/infrastructure/repositories/`

- `drizzle-segment-repository.ts` — implements `SegmentRepository`, moves `FilterEngine` integration inside
- `drizzle-tag-repository.ts` — implements `TagRepository`
- `drizzle-custom-field-repository.ts` — implements `CustomFieldRepository`
- `drizzle-company-repository.ts` — implements `CompanyRepository` (replaces the current raw function module)

### Contract Router Refactor

`contract-router.ts` shrinks to ~200 lines. Each handler:
1. Instantiates the repository
2. Calls the repository method
3. Maps the result to the API response

Delete: the serialize helpers (`serializeSegment`, `serializeTag`, `serializeField`) — replaced by entity `toProps()`.

Delete: `workers/crm/src/infrastructure/repositories/company-repository.ts` (the raw function module).

---

## PR 3: Journey Worker → Domain Entities

**Goal:** Wire the journey worker to use the existing domain entities and repository interfaces from `journey-domain`.

### New Drizzle Repository Implementation

File: `workers/journey/src/infrastructure/repositories/drizzle-journey-repository.ts`

Implements `JourneyRepository` from `@mauntic/journey-domain`:
- `findById()` → queries `journeys` table, returns `Journey.reconstitute()`
- `findByOrganization()` → paginated query, returns `Journey[]`
- `save()` → upsert (insert if no existing, update if exists)
- `delete()` → hard delete

Also implement:
- `DrizzleJourneyVersionRepository` for version CRUD
- `DrizzleJourneyStepRepository` for step CRUD
- `DrizzleJourneyTriggerRepository` for trigger CRUD

### New Application Service

File: `workers/journey/src/application/journey-service.ts`

```ts
export class JourneyService {
  constructor(
    private journeyRepo: JourneyRepository,
    private versionRepo: JourneyVersionRepository,
    private stepRepo: JourneyStepRepository,
    private triggerRepo: JourneyTriggerRepository,
  ) {}

  async create(orgId, input): Promise<Result<Journey>> { ... }
  async update(orgId, id, input): Promise<Result<Journey>> { ... }
  async publish(orgId, id): Promise<Result<Journey>> { ... }
  async pause(orgId, id): Promise<Result<Journey>> { ... }
  async resume(orgId, id): Promise<Result<Journey>> { ... }
  async archive(orgId, id): Promise<Result<Journey>> { ... }
  async delete(orgId, id): Promise<Result<void>> { ... }
}
```

The service uses the domain entity's state machine (`journey.publish()`, `journey.pause()`) which throws `InvariantViolation` on invalid transitions.

### Route Refactor

File: `workers/journey/src/interface/journey-routes.ts`

Refactor to:
1. Construct `JourneyService` from Drizzle repos
2. Call service methods
3. Return results

Delete: `workers/journey/src/infrastructure/repositories/journey-repository.ts` (raw function module), and the equivalent `version-repository.ts`, `step-repository.ts`, `trigger-repository.ts`, `execution-repository.ts` raw function files.

---

## PR 4: Scoring Queue Handler → Domain Services

**Goal:** Eliminate duplicated domain logic in `queue-handler.ts` by delegating to `ScoringEngine` and domain repositories.

### Changes

**4a. Replace `runBatchRecompute()` with `ScoringEngine`**

Current: ~60 lines of inline Drizzle that duplicates `IntentSignal.currentWeight()`.

New: Instantiate `ScoringEngine` with all 4 repos + scoring model, iterate contacts, call `engine.scoreContact()` + `engine.recordHistorySnapshot()`.

**4b. Replace `runSignalDecay()` with `IntentSignalRepository`**

Current: raw `db.delete(intentSignals).where(lte(expiresAt, now))`.

New: Add `deleteExpired(orgId): Promise<number>` to `IntentSignalRepository` interface and `DrizzleIntentSignalRepository`. The queue handler calls `repo.deleteExpired()`.

Note: `runSignalDecay` operates across ALL orgs (no orgId filter). The repository method needs a variant: `deleteAllExpired(): Promise<number>` for the cross-org batch path.

**4c. Replace `runAlertExpiry()` with `SignalAlertRepository`**

Current: raw `db.update(signalAlerts).set({ status: 'expired' })`.

New: Add `expireOverdue(): Promise<number>` to `SignalAlertRepository` interface. Or: load alerts, call `alert.expire()` on each, save. The former is more efficient for batch operations.

**4d. Delete `currentSignalWeight()` from `queue-handler.ts`**

This is the duplicated decay logic. After 4a, it's unused.

### Design Decision: Batch Efficiency

For `runSignalDecay` and `runAlertExpiry`, we add batch methods to the repository interfaces (`deleteAllExpired`, `expireOverdue`) rather than loading entities one-by-one. This is a pragmatic trade-off: batch DB operations are significantly more efficient than N individual entity saves, and these are pure infrastructure concerns (cleanup, not business logic).

---

## PR 5: Identity Worker → Domain Entities & Repositories

**Goal:** Wire identity commands to use the existing domain entities (`User`, `Organization`, `OrganizationInvite`, `OrganizationMember`) and repository interfaces.

### Scope Adjustment

The identity domain already has:
- Entities: `User`, `Organization`, `OrganizationInvite`, `OrganizationMember` (with proper methods)
- Repository interfaces: `UserRepository`, `OrganizationRepository`, `InviteRepository`, `MemberRepository`
- Value objects: `Email`, `Slug`

What's missing: Drizzle implementations and command refactoring.

### New Drizzle Repository Implementations

File: `workers/identity/src/infrastructure/repositories/`

- `drizzle-user-repository.ts` — implements `UserRepository`, maps rows to `User.reconstitute()`
- `drizzle-organization-repository.ts` — implements `OrganizationRepository`
- `drizzle-invite-repository.ts` — implements `InviteRepository`
- `drizzle-member-repository.ts` — implements `MemberRepository`

### Command Refactoring

Each command changes from `(db: DrizzleDb, input, actorRole) => raw row` to `(repos: { userRepo, memberRepo, ... }, input, actorRole) => domain entity`.

Example — `blockUser`:

Before:
```ts
async function blockUser(db: DrizzleDb, userId: string, organizationId: string) {
  const [membership] = await db.select().from(organizationMembers).where(...);
  if (membership.role === 'owner') throw new CannotBlockOwnerError();
  const [updated] = await db.update(users).set({ isBlocked: true }).where(...).returning();
  return updated;
}
```

After:
```ts
async function blockUser(userRepo: UserRepository, memberRepo: MemberRepository, userId: UserId, organizationId: OrganizationId) {
  const member = await memberRepo.findByOrgAndUser(organizationId, userId);
  if (!member) throw new UserNotInOrgError(userId, organizationId);
  const user = await userRepo.findById(userId);
  if (!user) throw new UserNotFoundError(userId);
  user.block(); // throws InvariantViolation if owner
  await userRepo.save(user);
  return user;
}
```

### Error Unification

Replace ad-hoc error classes (`CannotBlockOwnerError`, `UserNotFoundError`, etc.) with `DomainError` subclasses from the kernel, OR move them into `identity-domain` package as proper domain errors. The entity methods already use `InvariantViolation` from the kernel.

Recommendation: Keep the existing specific error classes but make them extend `DomainError` instead of plain `Error`. This gives both specificity and the kernel's `statusCode`/`code` mapping.

### Route Updates

Routes construct repositories from `db` context and pass them to commands, similar to how CRM routes construct `DrizzleContactRepository`.

---

## PR 6: Explicit Column Selection in All Repositories

**Goal:** Replace `db.select().from(table)` with explicit `db.select({ col1: table.col1, ... })` in every Drizzle repository.

### Approach

For each repository class:
1. Define a column map constant matching the entity's props
2. Use it in all select queries

Example:
```ts
const CONTACT_COLUMNS = {
  id: contacts.id,
  organizationId: contacts.organization_id,
  email: contacts.email,
  firstName: contacts.first_name,
  lastName: contacts.last_name,
  phone: contacts.phone,
  status: contacts.status,
  source: contacts.source,
  customFields: contacts.custom_fields,
  createdAt: contacts.created_at,
  updatedAt: contacts.updated_at,
} as const;

// Then in queries:
db.select(CONTACT_COLUMNS).from(contacts).where(...)
```

This explicitly excludes columns like `lead_score`, `lead_grade`, `intent_score`, `enrichment_status`, `data_quality_score`, `last_enriched_at` that are on the DB table but not part of `ContactProps`.

### Files to Update

- `workers/crm/src/infrastructure/repositories/drizzle-contact-repository.ts`
- All new repositories from PRs 2-5
- `workers/scoring/src/infrastructure/drizzle-lead-score-repository.ts`
- `workers/scoring/src/infrastructure/drizzle-scoring-repositories.ts`
- `services/journey-executor/src/infrastructure/repositories/drizzle-journey-repository.ts`
- Any other Drizzle repository doing `db.select().from()`

### Not Included

Inline queries in queue handlers and route stubs (e.g., `count()` queries) that already select specific columns are fine as-is.

---

## Execution Order

```
PR 1 (Branded IDs) → PR 2 (CRM repos) → PR 3 (Journey) → PR 4 (Scoring) → PR 5 (Identity) → PR 6 (Select columns)
```

PR 1 is a prerequisite for PRs 2-5 (they use branded types).
PR 6 goes last to cover all new and existing repositories.
PRs 2-5 are independent of each other and could theoretically parallelize after PR 1 lands.

## Testing Strategy

- All PRs: `tsc --noEmit` must pass (type safety is the primary guard)
- PRs 2-5: Existing view routes and API consumers should work unchanged (behavior-preserving refactors)
- PR 6: Verify no `select *` queries remain via grep
