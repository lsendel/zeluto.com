# Revenue Intelligence Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete RevOps UI with inline intelligence layer — pipeline board, deal detail, intent signals, data quality, buying committees, conversation intelligence, prospects, sequences, and forecasts.

**Architecture:** HTMX SSR views served from the revops worker, composed via gateway routing. Intelligence features are pure domain services in `@mauntic/revops-domain`, surfaced as lazy-loaded HTMX fragments on deal detail and contact detail pages. New tables in the `revops` Drizzle schema with event-driven cache updates.

**Tech Stack:** Hono + JSX views, Drizzle ORM on Neon PostgreSQL, HTMX for interactivity, Tailwind for styling, Vitest for testing, Claude LLM for AI features.

**Design Doc:** `docs/plans/2026-02-20-revenue-intelligence-design.md`

---

## Phase 1: Pipeline Board + Deal Detail (Foundation)

### Task 1.1: Add Revenue to Sidebar Navigation

**Files:**
- Modify: `packages/ui-kit/src/layouts/app-layout.tsx` (buildNavGroups function)

**Step 1: Write the failing test**

No unit test needed — this is a JSX layout change. Verify visually after.

**Step 2: Add Revenue nav group to buildNavGroups**

In `packages/ui-kit/src/layouts/app-layout.tsx`, add a `revenue` icon to `navIcons`:

```typescript
revenue: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
```

Then add the Revenue group between "Channels" and "Insights" in `buildNavGroups()`:

```typescript
{
  title: 'Revenue',
  items: [
    {
      label: 'Pipeline',
      href: '/app/revops/pipeline',
      icon: <Icon d={navIcons.revenue} />,
      active: isActive('/app/revops/pipeline'),
    },
    {
      label: 'Deals',
      href: '/app/revops/deals',
      icon: <Icon d={navIcons.revenue} />,
      active: isActive('/app/revops/deals'),
    },
    {
      label: 'Prospects',
      href: '/app/revops/prospects',
      icon: <Icon d={navIcons.revenue} />,
      active: isActive('/app/revops/prospects'),
    },
    {
      label: 'Sequences',
      href: '/app/revops/sequences',
      icon: <Icon d={navIcons.revenue} />,
      active: isActive('/app/revops/sequences'),
    },
    {
      label: 'Forecasts',
      href: '/app/revops/forecasts',
      icon: <Icon d={navIcons.revenue} />,
      active: isActive('/app/revops/forecasts'),
    },
  ],
},
```

**Step 3: Build ui-kit**

Run: `cd packages/ui-kit && pnpm build`

**Step 4: Commit**

```bash
git add packages/ui-kit/src/layouts/app-layout.tsx
git commit -m "feat(ui-kit): add Revenue group to sidebar navigation"
```

---

### Task 1.2: Wire Gateway Routing for RevOps Views

**Files:**
- Modify: `workers/gateway/src/routes/pages.tsx` (getViewServiceBinding + resolveViewPath)

**Step 1: Add revops to getViewServiceBinding**

In the `getViewServiceBinding` function, add before the `return null`:

```typescript
if (path.startsWith('/app/revops')) return c.env.REVOPS;
```

**Step 2: Add revops to resolveViewPath**

The revops worker routes already use `/app/revops/*` internally, so no path remapping needed. But ensure `/app/revops` (without trailing path) routes to pipeline:

```typescript
if (path === '/app/revops' || path === '/app/revops/') return '/app/revops/pipeline';
```

**Step 3: Commit**

```bash
git add workers/gateway/src/routes/pages.tsx
git commit -m "feat(gateway): wire revops views to gateway page routing"
```

---

### Task 1.3: Create deal_health_cache Table in Schema

**Files:**
- Modify: `packages/domains/revops-domain/drizzle/schema.ts`

**Step 1: Add deal_health_cache table**

Add after the existing `workflowExecutions` table:

```typescript
export const dealHealthCache = revopsSchema.table('deal_health_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  deal_id: uuid('deal_id').notNull(),
  score: integer('score').notNull().default(100),
  risk_level: varchar('risk_level', { length: 20 }).notNull().default('healthy'),
  flags: jsonb('flags').$type<Array<{ type: string; message: string; severity: string }>>(),
  next_action_type: varchar('next_action_type', { length: 50 }),
  next_action_summary: text('next_action_summary'),
  computed_at: timestamp('computed_at').notNull().defaultNow(),
}, (table) => ({
  dealIdx: { columns: [table.deal_id], unique: true },
  orgRiskIdx: { columns: [table.organization_id, table.risk_level] },
}));
```

**Step 2: Generate migration**

Run: `cd packages/domains/revops-domain && pnpm db:generate`

**Step 3: Build domain package**

Run: `cd packages/domains/revops-domain && pnpm build`

**Step 4: Apply migration to Neon**

Use the Neon MCP tool `run_sql` to execute the generated SQL migration against the `steep-sun-74281455` project.

**Step 5: Commit**

```bash
git add packages/domains/revops-domain/drizzle/
git commit -m "feat(revops-domain): add deal_health_cache table"
```

---

### Task 1.4: Create Deal Health Cache Repository

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/deal-health-cache-repository.ts`

**Step 1: Write the repository**

```typescript
import { eq, and } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { dealHealthCache } from '@mauntic/revops-domain/drizzle';

export type DealHealthCacheRow = typeof dealHealthCache.$inferSelect;

export async function findHealthByDeal(
  db: NeonHttpDatabase,
  orgId: string,
  dealId: string,
): Promise<DealHealthCacheRow | undefined> {
  const rows = await db
    .select()
    .from(dealHealthCache)
    .where(and(eq(dealHealthCache.organization_id, orgId), eq(dealHealthCache.deal_id, dealId)))
    .limit(1);
  return rows[0];
}

export async function findHealthByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<DealHealthCacheRow[]> {
  return db
    .select()
    .from(dealHealthCache)
    .where(eq(dealHealthCache.organization_id, orgId));
}

export async function upsertHealth(
  db: NeonHttpDatabase,
  orgId: string,
  dealId: string,
  data: {
    score: number;
    riskLevel: string;
    flags: Array<{ type: string; message: string; severity: string }>;
    nextActionType: string | null;
    nextActionSummary: string | null;
  },
): Promise<void> {
  const existing = await findHealthByDeal(db, orgId, dealId);
  if (existing) {
    await db
      .update(dealHealthCache)
      .set({
        score: data.score,
        risk_level: data.riskLevel,
        flags: data.flags,
        next_action_type: data.nextActionType,
        next_action_summary: data.nextActionSummary,
        computed_at: new Date(),
      })
      .where(eq(dealHealthCache.id, existing.id));
  } else {
    await db.insert(dealHealthCache).values({
      organization_id: orgId,
      deal_id: dealId,
      score: data.score,
      risk_level: data.riskLevel,
      flags: data.flags,
      next_action_type: data.nextActionType,
      next_action_summary: data.nextActionSummary,
    });
  }
}
```

**Step 2: Commit**

```bash
git add workers/revops/src/infrastructure/repositories/deal-health-cache-repository.ts
git commit -m "feat(revops): add deal health cache repository"
```

---

### Task 1.5: Create Deal Health Cache Service

**Files:**
- Create: `packages/domains/revops-domain/src/services/deal-health-cache-service.ts`
- Modify: `packages/domains/revops-domain/src/services/index.ts`

**Step 1: Write the failing test**

Create `packages/domains/revops-domain/src/services/deal-health-cache-service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ActivityProps } from '../entities/activity.js';
import type { DealProps } from '../entities/deal.js';
import { DealHealthCacheComputer } from './deal-health-cache-service.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const DEAL_ID = '22222222-2222-4222-8222-222222222222';

function buildDeal(overrides?: Partial<DealProps>): DealProps {
  return {
    id: DEAL_ID,
    organizationId: ORG_ID,
    contactId: '33333333-3333-4333-8333-333333333333',
    name: 'Test Deal',
    stage: 'qualification',
    value: 50000,
    probability: 20,
    priority: 'medium',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-10'),
    ...overrides,
  };
}

describe('DealHealthCacheComputer', () => {
  it('computes cache entry from deal and activities', () => {
    const computer = new DealHealthCacheComputer();
    const now = new Date('2026-03-01');
    const result = computer.compute(
      buildDeal(),
      [{ id: 'a1', organizationId: ORG_ID, type: 'email', createdAt: new Date('2026-02-01') } as ActivityProps],
      now,
    );

    expect(result.score).toBeLessThan(100);
    expect(result.riskLevel).toBeDefined();
    expect(result.nextActionType).toBeDefined();
    expect(result.nextActionSummary).toBeDefined();
    expect(result.flags).toBeInstanceOf(Array);
  });

  it('returns healthy for closed deals', () => {
    const computer = new DealHealthCacheComputer();
    const result = computer.compute(
      buildDeal({ stage: 'closed_won' }),
      [],
      new Date('2026-02-20'),
    );

    expect(result.riskLevel).toBe('healthy');
    expect(result.score).toBe(100);
    expect(result.nextActionType).toBe('none');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/domains/revops-domain && pnpm test -- --run deal-health-cache-service`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/domains/revops-domain/src/services/deal-health-cache-service.ts`:

```typescript
import type { ActivityProps } from '../entities/activity.js';
import type { DealProps } from '../entities/deal.js';
import { DealInspector } from './deal-inspector.js';
import { NextBestActionAdvisor } from './next-best-action.js';

export interface DealHealthCacheEntry {
  score: number;
  riskLevel: string;
  flags: Array<{ type: string; message: string; severity: string }>;
  nextActionType: string;
  nextActionSummary: string;
}

export class DealHealthCacheComputer {
  private readonly inspector = new DealInspector();
  private readonly advisor = new NextBestActionAdvisor(this.inspector);

  compute(deal: DealProps, activities: ActivityProps[], now: Date = new Date()): DealHealthCacheEntry {
    const report = this.inspector.inspect(deal, activities);
    const recommendation = this.advisor.recommend({ deal, activities, healthReport: report, now });

    return {
      score: report.score,
      riskLevel: report.riskLevel,
      flags: report.flags.map((msg) => ({
        type: report.riskLevel,
        message: msg,
        severity: report.riskLevel === 'critical' ? 'error' : report.riskLevel === 'at_risk' ? 'warning' : 'info',
      })),
      nextActionType: recommendation.action.type,
      nextActionSummary: recommendation.action.title,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/domains/revops-domain && pnpm test -- --run deal-health-cache-service`
Expected: PASS

**Step 5: Add export to services index**

Add to `packages/domains/revops-domain/src/services/index.ts`:

```typescript
export * from './deal-health-cache-service.js';
```

**Step 6: Build**

Run: `cd packages/domains/revops-domain && pnpm build`

**Step 7: Commit**

```bash
git add packages/domains/revops-domain/src/services/deal-health-cache-service.ts \
       packages/domains/revops-domain/src/services/deal-health-cache-service.test.ts \
       packages/domains/revops-domain/src/services/index.ts
git commit -m "feat(revops-domain): add DealHealthCacheComputer service with tests"
```

---

### Task 1.6: Create Pipeline Board View

**Files:**
- Modify: `workers/revops/src/views/deal-pipeline.tsx` (rewrite with intelligence indicators)

**Step 1: Rewrite the pipeline view**

Replace the contents of `workers/revops/src/views/deal-pipeline.tsx`:

```typescript
import type { FC } from 'hono/jsx';
import type { DealRow } from '../infrastructure/repositories/deal-repository.js';
import type { DealHealthCacheRow } from '../infrastructure/repositories/deal-health-cache-repository.js';

const STAGES = [
  'prospecting',
  'qualification',
  'needs_analysis',
  'proposal',
  'negotiation',
  'contract_sent',
  'closed_won',
  'closed_lost',
] as const;

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  contract_sent: 'Contract Sent',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-blue-50 border-blue-200',
  qualification: 'bg-indigo-50 border-indigo-200',
  needs_analysis: 'bg-purple-50 border-purple-200',
  proposal: 'bg-yellow-50 border-yellow-200',
  negotiation: 'bg-orange-50 border-orange-200',
  contract_sent: 'bg-amber-50 border-amber-200',
  closed_won: 'bg-green-50 border-green-200',
  closed_lost: 'bg-red-50 border-red-200',
};

const RISK_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  at_risk: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const HealthDot: FC<{ riskLevel?: string }> = ({ riskLevel }) => {
  const color = RISK_DOT[riskLevel ?? ''] ?? 'bg-gray-300';
  return <span class={`inline-block h-2 w-2 rounded-full ${color}`} title={riskLevel ?? 'unknown'} />;
};

export interface PipelineBoardProps {
  deals: DealRow[];
  healthMap: Record<string, DealHealthCacheRow>;
  repFilter?: string;
}

export const PipelineBoardView: FC<PipelineBoardProps> = ({ deals, healthMap, repFilter }) => {
  const visibleStages = STAGES.filter((s) => s !== 'closed_lost');

  return (
    <div id="pipeline-board">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p class="mt-1 text-sm text-gray-500">
            {deals.length} deals | ${deals.reduce((s, d) => s + Number(d.value), 0).toLocaleString()} total
          </p>
        </div>
        <div class="flex items-center gap-3">
          <select
            name="repFilter"
            hx-get="/app/revops/pipeline"
            hx-target="#pipeline-board"
            hx-swap="outerHTML"
            hx-include="this"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" selected={!repFilter}>All Deals</option>
          </select>
          <button
            hx-get="/app/revops/deals/new"
            hx-target="#modal-container"
            hx-swap="innerHTML"
            class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Deal
          </button>
        </div>
      </div>

      <div class="flex gap-3 overflow-x-auto pb-4">
        {visibleStages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          const stageValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);

          return (
            <div class={`flex-shrink-0 w-56 rounded-lg border p-3 ${STAGE_COLORS[stage] ?? 'bg-gray-50 border-gray-200'}`}>
              <div class="mb-3">
                <h3 class="text-xs font-semibold uppercase text-gray-600">{STAGE_LABELS[stage]}</h3>
                <p class="text-xs text-gray-500">{stageDeals.length} deals | ${stageValue.toLocaleString()}</p>
              </div>
              <div class="space-y-2">
                {stageDeals.slice(0, 5).map((deal) => {
                  const health = healthMap[deal.id];
                  return (
                    <div
                      class="rounded-lg border border-white bg-white p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      hx-get={`/app/revops/deals/${deal.id}`}
                      hx-target="#app-content"
                      hx-push-url="true"
                    >
                      <div class="flex items-center justify-between mb-1">
                        <p class="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
                        <HealthDot riskLevel={health?.risk_level} />
                      </div>
                      <p class="text-xs text-gray-500 mb-2">${Number(deal.value).toLocaleString()}</p>
                      {health?.next_action_type && health.next_action_type !== 'none' && (
                        <p class="text-xs text-gray-400 truncate">{health.next_action_summary}</p>
                      )}
                    </div>
                  );
                })}
                {stageDeals.length > 5 && (
                  <p class="text-xs text-gray-400 text-center">+{stageDeals.length - 5} more</p>
                )}
                {stageDeals.length === 0 && (
                  <p class="text-xs text-gray-400 text-center italic">No deals</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add workers/revops/src/views/deal-pipeline.tsx
git commit -m "feat(revops): rewrite pipeline board view with health indicators"
```

---

### Task 1.7: Create Deal Detail View

**Files:**
- Create: `workers/revops/src/views/deal-detail.tsx`

**Step 1: Create the deal detail view**

```typescript
import type { FC } from 'hono/jsx';
import type { DealRow } from '../infrastructure/repositories/deal-repository.js';
import type { ActivityRow } from '../infrastructure/repositories/activity-repository.js';
import type { DealHealthCacheRow } from '../infrastructure/repositories/deal-health-cache-repository.js';

const STAGES = [
  'prospecting', 'qualification', 'needs_analysis', 'proposal',
  'negotiation', 'contract_sent', 'closed_won', 'closed_lost',
] as const;

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  healthy: { bg: 'bg-green-100', text: 'text-green-800' },
  at_risk: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  critical: { bg: 'bg-red-100', text: 'text-red-800' },
};

const ACTIVITY_ICONS: Record<string, string> = {
  email: '📧', call: '📞', meeting: '📅', demo: '🖥️',
  task: '📋', note: '📝', linkedin: '💼', sms: '💬',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(d: Date | string | null): string {
  if (!d) return '—';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export interface DealDetailProps {
  deal: DealRow;
  activities: ActivityRow[];
  health: DealHealthCacheRow | undefined;
}

const StageProgress: FC<{ currentStage: string }> = ({ currentStage }) => {
  const activeIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);
  return (
    <div class="flex items-center gap-1 mt-2">
      {STAGES.filter((s) => s !== 'closed_lost').map((stage, i) => {
        const isCurrent = stage === currentStage;
        const isPast = i < activeIdx;
        const color = isCurrent ? 'bg-brand-600 text-white' : isPast ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400';
        return (
          <span class={`px-2 py-0.5 text-xs rounded-full ${color}`}>
            {stage.replace(/_/g, ' ')}
          </span>
        );
      })}
    </div>
  );
};

const HealthPanel: FC<{ health: DealHealthCacheRow | undefined; dealId: string }> = ({ health, dealId }) => {
  if (!health) {
    return (
      <div class="rounded-xl border border-gray-200 bg-white p-4"
           hx-get={`/app/revops/deals/${dealId}/health`}
           hx-trigger="load"
           hx-swap="outerHTML">
        <p class="text-sm text-gray-400 animate-pulse">Loading health...</p>
      </div>
    );
  }

  const risk = RISK_COLORS[health.risk_level] ?? RISK_COLORS.healthy;
  const flags = (health.flags as Array<{ type: string; message: string; severity: string }>) ?? [];

  return (
    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-gray-900 mb-3">Deal Health</h3>
      <div class="flex items-center gap-2 mb-3">
        <span class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${risk.bg} ${risk.text}`}>
          {health.risk_level.replace(/_/g, ' ')}
        </span>
        <span class="text-lg font-bold text-gray-900">{health.score}/100</span>
      </div>
      {flags.length > 0 && (
        <div class="space-y-1">
          {flags.map((f) => (
            <p class="text-xs text-gray-600">
              <span class={f.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                {f.severity === 'error' ? '✕' : '⚠'}
              </span>{' '}
              {f.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const NextBestActionPanel: FC<{ health: DealHealthCacheRow | undefined; dealId: string }> = ({ health, dealId }) => {
  if (!health || !health.next_action_type || health.next_action_type === 'none') return null;

  return (
    <div class="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
      <h3 class="text-sm font-semibold text-brand-900 mb-2">Next Best Action</h3>
      <p class="text-sm text-brand-800 font-medium">{health.next_action_summary}</p>
      <div class="mt-3 flex gap-2">
        <button
          hx-get={`/app/revops/deals/${dealId}/email-copilot`}
          hx-target="#modal-container"
          hx-swap="innerHTML"
          class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Draft Email
        </button>
        <button
          hx-get={`/app/revops/deals/${dealId}/log-activity`}
          hx-target="#modal-container"
          hx-swap="innerHTML"
          class="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Log Call
        </button>
      </div>
    </div>
  );
};

const ActivityTimeline: FC<{ activities: ActivityRow[] }> = ({ activities }) => {
  const sorted = [...activities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-sm font-semibold text-gray-900">Activity Timeline</h3>
        <button
          hx-get="/app/revops/deals/log-activity"
          hx-target="#modal-container"
          hx-swap="innerHTML"
          class="text-xs text-brand-600 hover:text-brand-800 font-medium"
        >
          + Log
        </button>
      </div>
      {sorted.length === 0 ? (
        <p class="text-sm text-gray-400 italic">No activities yet.</p>
      ) : (
        <div class="space-y-3">
          {sorted.map((a) => (
            <div class="flex gap-3 text-sm">
              <span class="text-base">{ACTIVITY_ICONS[a.type] ?? '📌'}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900 capitalize">{a.type}</span>
                  {a.duration_minutes && <span class="text-xs text-gray-400">{a.duration_minutes} min</span>}
                </div>
                {a.notes && <p class="text-gray-600 truncate">{a.notes}</p>}
                {a.outcome && (
                  <span class="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {a.outcome}
                  </span>
                )}
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">{daysAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DealDetailView: FC<DealDetailProps> = ({ deal, activities, health }) => {
  const risk = RISK_COLORS[health?.risk_level ?? ''] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <div id="deal-detail">
      {/* Header */}
      <div class="mb-6">
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <a hx-get="/app/revops/pipeline" hx-target="#app-content" hx-push-url="true"
             class="hover:text-brand-600 cursor-pointer">← Pipeline</a>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900">{deal.name}</h1>
              {health && (
                <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${risk.bg} ${risk.text}`}>
                  {health.risk_level.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p class="text-lg font-semibold text-gray-700 mt-1">${Number(deal.value).toLocaleString()}</p>
          </div>
          <div class="text-right text-sm text-gray-500">
            <p>Rep: {deal.assigned_rep ?? 'Unassigned'}</p>
            <p>Expected: {formatDate(deal.expected_close_at)}</p>
            <p>Created: {daysAgo(deal.created_at)}</p>
          </div>
        </div>
        <StageProgress currentStage={deal.stage} />
      </div>

      {/* Two-column layout */}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div class="lg:col-span-3 space-y-4">
          <NextBestActionPanel health={health} dealId={deal.id} />
          <ActivityTimeline activities={activities} />
        </div>

        {/* Right column (2/5) */}
        <div class="lg:col-span-2 space-y-4">
          <HealthPanel health={health} dealId={deal.id} />

          {/* Placeholder panels for Phase 2-3 features */}
          <div id="intent-signals-panel"
               hx-get={`/app/revops/deals/${deal.id}/signals`}
               hx-trigger="load"
               hx-swap="outerHTML">
          </div>
          <div id="buying-committee-panel"
               hx-get={`/app/revops/deals/${deal.id}/committee`}
               hx-trigger="load"
               hx-swap="outerHTML">
          </div>
          <div id="research-panel"
               hx-get={`/app/revops/deals/${deal.id}/research`}
               hx-trigger="load"
               hx-swap="outerHTML">
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add workers/revops/src/views/deal-detail.tsx
git commit -m "feat(revops): add deal detail view with health and NBA panels"
```

---

### Task 1.8: Create View Routes and Wire Everything

**Files:**
- Create: `workers/revops/src/interface/view-routes.tsx`
- Modify: `workers/revops/src/app.tsx`

**Step 1: Create view routes**

```typescript
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findDealsByOrganization, findDealById } from '../infrastructure/repositories/deal-repository.js';
import { findActivitiesByDeal } from '../infrastructure/repositories/activity-repository.js';
import { findHealthByOrganization, findHealthByDeal } from '../infrastructure/repositories/deal-health-cache-repository.js';
import { PipelineBoardView } from '../views/deal-pipeline.js';
import { DealDetailView } from '../views/deal-detail.js';

export const viewRoutes = new Hono<Env>();

viewRoutes.get('/app/revops/pipeline', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const repFilter = c.req.query('repFilter') || undefined;
    const result = await findDealsByOrganization(db, tenant.organizationId, {
      page: 1,
      limit: 200,
      assignedRep: repFilter,
    });

    const healthRows = await findHealthByOrganization(db, tenant.organizationId);
    const healthMap: Record<string, typeof healthRows[number]> = {};
    for (const h of healthRows) {
      healthMap[h.deal_id] = h;
    }

    return c.html(<PipelineBoardView deals={result.data} healthMap={healthMap} repFilter={repFilter} />);
  } catch (error) {
    console.error('Pipeline view error:', error);
    return c.html(<div class="p-4 text-red-600">Failed to load pipeline.</div>, 500);
  }
});

viewRoutes.get('/app/revops/deals/:dealId', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { dealId } = c.req.param();

  try {
    const deal = await findDealById(db, tenant.organizationId, dealId);
    if (!deal) {
      return c.html(<div class="p-4 text-gray-500">Deal not found.</div>, 404);
    }

    const activities = await findActivitiesByDeal(db, tenant.organizationId, dealId);
    const health = await findHealthByDeal(db, tenant.organizationId, dealId);

    return c.html(<DealDetailView deal={deal} activities={activities} health={health} />);
  } catch (error) {
    console.error('Deal detail view error:', error);
    return c.html(<div class="p-4 text-red-600">Failed to load deal.</div>, 500);
  }
});

// Stub routes for Phase 2-3 panels (return empty fragments so HTMX doesn't error)
viewRoutes.get('/app/revops/deals/:dealId/signals', async (c) => {
  return c.html(<div id="intent-signals-panel" />);
});

viewRoutes.get('/app/revops/deals/:dealId/committee', async (c) => {
  return c.html(<div id="buying-committee-panel" />);
});

viewRoutes.get('/app/revops/deals/:dealId/research', async (c) => {
  return c.html(<div id="research-panel" />);
});
```

**Step 2: Mount view routes in app.tsx**

Add import to `workers/revops/src/app.tsx`:

```typescript
import { viewRoutes } from './interface/view-routes.js';
```

Add route mounting after the existing `app.route('/', workflowRoutes)`:

```typescript
app.route('/', viewRoutes);
```

**Step 3: Verify deal repository supports assignedRep filter**

Check that `findDealsByOrganization` accepts `assignedRep` in its options. If not, add it to the repository query (add `and(eq(deals.assigned_rep, options.assignedRep))` to the where clause when provided).

**Step 4: Build and test**

Run: `cd packages/ui-kit && pnpm build && cd ../../workers/revops && pnpm typecheck`

**Step 5: Commit**

```bash
git add workers/revops/src/interface/view-routes.tsx workers/revops/src/app.tsx
git commit -m "feat(revops): add pipeline and deal detail view routes, wire to app"
```

---

### Task 1.9: Deploy and Verify Phase 1

**Step 1: Build all dependencies**

```bash
cd packages/domains/revops-domain && pnpm build
cd ../../packages/ui-kit && pnpm build
cd ../../packages/worker-lib && pnpm build
```

**Step 2: Deploy gateway** (for sidebar + routing changes)

```bash
cd workers/gateway && npx wrangler deploy
```

**Step 3: Deploy revops worker**

```bash
cd workers/revops && npx wrangler deploy
```

**Step 4: Verify in browser**

1. Navigate to the app — "Revenue" should appear in sidebar
2. Click "Pipeline" — kanban board should render with any existing deals
3. Click a deal card — deal detail page should render with health panel and activity timeline
4. Health dots should show on pipeline cards (may require triggering a cache update first)

**Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(revops): phase 1 deployment fixes"
```

---

## Phase 2: Data Quality + Intent Signals

### Task 2.1: Add intent_signals and contact_quality_scores Tables

**Files:**
- Modify: `packages/domains/revops-domain/drizzle/schema.ts`

**Step 1: Add intent_signals table**

```typescript
export const intentSignals = revopsSchema.table('intent_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  deal_id: uuid('deal_id'),
  signal_type: varchar('signal_type', { length: 50 }).notNull(),
  source: varchar('source', { length: 100 }).notNull().default('crm'),
  strength: numeric('strength', { precision: 3, scale: 2 }).notNull().default('0.5'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  occurred_at: timestamp('occurred_at').notNull().defaultNow(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id, table.occurred_at] },
  orgDealIdx: { columns: [table.organization_id, table.deal_id] },
  orgTypeIdx: { columns: [table.organization_id, table.signal_type] },
}));
```

**Step 2: Add contact_quality_scores table**

```typescript
export const contactQualityScores = revopsSchema.table('contact_quality_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull(),
  contact_id: uuid('contact_id').notNull(),
  overall_score: numeric('overall_score', { precision: 5, scale: 2 }).notNull().default('0'),
  completeness: numeric('completeness', { precision: 5, scale: 2 }).notNull().default('0'),
  accuracy: numeric('accuracy', { precision: 5, scale: 2 }).notNull().default('0'),
  freshness: numeric('freshness', { precision: 5, scale: 2 }).notNull().default('0'),
  consistency: numeric('consistency', { precision: 5, scale: 2 }).notNull().default('0'),
  issues: jsonb('issues').$type<Array<{ field: string; issue: string; severity: string }>>(),
  computed_at: timestamp('computed_at').notNull().defaultNow(),
}, (table) => ({
  orgContactIdx: { columns: [table.organization_id, table.contact_id], unique: true },
  orgScoreIdx: { columns: [table.organization_id, table.overall_score] },
}));
```

**Step 3: Generate migration, build, apply**

```bash
cd packages/domains/revops-domain && pnpm db:generate && pnpm build
```

Apply migration via Neon MCP tool.

**Step 4: Commit**

```bash
git add packages/domains/revops-domain/drizzle/
git commit -m "feat(revops-domain): add intent_signals and contact_quality_scores tables"
```

---

### Task 2.2: Create Intent Signal Service

**Files:**
- Create: `packages/domains/revops-domain/src/services/intent-signal-service.ts`
- Create: `packages/domains/revops-domain/src/services/intent-signal-service.test.ts`
- Modify: `packages/domains/revops-domain/src/services/index.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { IntentSignalService, type IntentSignal } from './intent-signal-service.js';

const service = new IntentSignalService();
const now = new Date('2026-02-20T12:00:00Z');

function signal(daysAgo: number, strength: number, type = 'website_visit'): IntentSignal {
  const occurred = new Date(now.getTime() - daysAgo * 86400000);
  return { signalType: type, strength, occurredAt: occurred, source: 'crm' };
}

describe('IntentSignalService', () => {
  describe('getEffectiveStrength', () => {
    it('returns full strength for signals < 3 days old', () => {
      expect(service.getEffectiveStrength(signal(1, 0.9), now)).toBe(0.9);
    });

    it('decays to 0.8x for 3-7 day old signals', () => {
      expect(service.getEffectiveStrength(signal(5, 1.0), now)).toBeCloseTo(0.8);
    });

    it('decays to 0.5x for 7-14 day old signals', () => {
      expect(service.getEffectiveStrength(signal(10, 1.0), now)).toBeCloseTo(0.5);
    });

    it('decays to 0.2x for 14-30 day old signals', () => {
      expect(service.getEffectiveStrength(signal(20, 1.0), now)).toBeCloseTo(0.2);
    });

    it('returns 0 for 30+ day old signals', () => {
      expect(service.getEffectiveStrength(signal(35, 1.0), now)).toBe(0);
    });
  });

  describe('computeIntentTier', () => {
    it('returns cold for no signals', () => {
      expect(service.computeIntentTier([], now)).toBe('cold');
    });

    it('returns hot for sum >= 1.5', () => {
      const signals = [signal(1, 0.9), signal(2, 0.8)];
      expect(service.computeIntentTier(signals, now)).toBe('hot');
    });

    it('returns active_buying for sum >= 3.0', () => {
      const signals = [signal(0, 1.0), signal(1, 1.0), signal(1, 0.9), signal(2, 0.5)];
      expect(service.computeIntentTier(signals, now)).toBe('active_buying');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/domains/revops-domain && pnpm test -- --run intent-signal-service`

**Step 3: Write implementation**

```typescript
export interface IntentSignal {
  signalType: string;
  strength: number;
  occurredAt: Date;
  source: string;
}

export type IntentTier = 'cold' | 'warm' | 'hot' | 'active_buying';

const DECAY_BRACKETS: Array<{ maxDays: number; factor: number }> = [
  { maxDays: 3, factor: 1.0 },
  { maxDays: 7, factor: 0.8 },
  { maxDays: 14, factor: 0.5 },
  { maxDays: 30, factor: 0.2 },
];

export class IntentSignalService {
  getEffectiveStrength(signal: IntentSignal, now: Date = new Date()): number {
    const daysOld = (now.getTime() - new Date(signal.occurredAt).getTime()) / 86400000;
    for (const bracket of DECAY_BRACKETS) {
      if (daysOld < bracket.maxDays) {
        return Math.round(signal.strength * bracket.factor * 100) / 100;
      }
    }
    return 0;
  }

  computeIntentTier(signals: IntentSignal[], now: Date = new Date()): IntentTier {
    const totalStrength = signals.reduce((sum, s) => sum + this.getEffectiveStrength(s, now), 0);
    if (totalStrength >= 3.0) return 'active_buying';
    if (totalStrength >= 1.5) return 'hot';
    if (totalStrength >= 0.5) return 'warm';
    return 'cold';
  }

  aggregateForDeal(signals: IntentSignal[], now: Date = new Date()): {
    tier: IntentTier;
    activeCount: number;
    totalStrength: number;
  } {
    const active = signals.filter((s) => this.getEffectiveStrength(s, now) > 0);
    const totalStrength = active.reduce((sum, s) => sum + this.getEffectiveStrength(s, now), 0);
    return {
      tier: this.computeIntentTier(signals, now),
      activeCount: active.length,
      totalStrength: Math.round(totalStrength * 100) / 100,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/domains/revops-domain && pnpm test -- --run intent-signal-service`

**Step 5: Add export, build, commit**

Add `export * from './intent-signal-service.js';` to `services/index.ts`.

```bash
cd packages/domains/revops-domain && pnpm build
git add packages/domains/revops-domain/src/services/intent-signal-service*
git add packages/domains/revops-domain/src/services/index.ts
git commit -m "feat(revops-domain): add IntentSignalService with decay and tier calculation"
```

---

### Task 2.3: Create Data Quality Service

**Files:**
- Create: `packages/domains/revops-domain/src/services/data-quality-service.ts`
- Create: `packages/domains/revops-domain/src/services/data-quality-service.test.ts`
- Modify: `packages/domains/revops-domain/src/services/index.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { DataQualityService } from './data-quality-service.js';

const service = new DataQualityService();

describe('DataQualityService', () => {
  it('scores a fully complete contact as high quality', () => {
    const result = service.assessQuality({
      email: 'lisa@acme.com',
      phone: '+14155551234',
      firstName: 'Lisa',
      lastName: 'Park',
      title: 'VP Engineering',
      company: 'Acme Corp',
      updatedAt: new Date(),
    });

    expect(result.overall).toBeGreaterThan(80);
    expect(result.completeness).toBe(100);
    expect(result.accuracy).toBeGreaterThan(80);
    expect(result.issues).toHaveLength(0);
  });

  it('flags missing fields as completeness issues', () => {
    const result = service.assessQuality({
      email: 'lisa@acme.com',
      phone: null,
      firstName: 'Lisa',
      lastName: null,
      title: null,
      company: null,
      updatedAt: new Date(),
    });

    expect(result.completeness).toBeLessThan(60);
    expect(result.issues.some((i) => i.field === 'phone')).toBe(true);
  });

  it('flags invalid email format as accuracy issue', () => {
    const result = service.assessQuality({
      email: 'not-an-email',
      phone: '+14155551234',
      firstName: 'Lisa',
      lastName: 'Park',
      title: 'VP',
      company: 'Acme',
      updatedAt: new Date(),
    });

    expect(result.accuracy).toBeLessThan(100);
    expect(result.issues.some((i) => i.field === 'email' && i.issue === 'invalid_format')).toBe(true);
  });

  it('decays freshness for old data', () => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
    const result = service.assessQuality({
      email: 'lisa@acme.com',
      phone: '+14155551234',
      firstName: 'Lisa',
      lastName: 'Park',
      title: 'VP',
      company: 'Acme',
      updatedAt: sixMonthsAgo,
    });

    expect(result.freshness).toBeLessThan(20);
  });
});
```

**Step 2: Run test, verify fail**

Run: `cd packages/domains/revops-domain && pnpm test -- --run data-quality-service`

**Step 3: Write implementation**

```typescript
export interface ContactData {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  updatedAt: Date;
}

export interface QualityIssue {
  field: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface QualityResult {
  overall: number;
  completeness: number;
  accuracy: number;
  freshness: number;
  consistency: number;
  issues: QualityIssue[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;
const PLACEHOLDER_VALUES = ['test@test.com', 'n/a', 'na', 'none', 'unknown', 'xxx', 'test'];

const REQUIRED_FIELDS: Array<{ key: keyof ContactData; label: string }> = [
  { key: 'email', label: 'email' },
  { key: 'phone', label: 'phone' },
  { key: 'firstName', label: 'first_name' },
  { key: 'lastName', label: 'last_name' },
  { key: 'title', label: 'title' },
  { key: 'company', label: 'company' },
];

export class DataQualityService {
  assessQuality(contact: ContactData): QualityResult {
    const issues: QualityIssue[] = [];

    const completeness = this.scoreCompleteness(contact, issues);
    const accuracy = this.scoreAccuracy(contact, issues);
    const freshness = this.scoreFreshness(contact);
    const consistency = 100; // v1: no cross-field rules yet

    const overall = Math.round((completeness + accuracy + freshness + consistency) / 4);

    return { overall, completeness, accuracy, freshness, consistency, issues };
  }

  private scoreCompleteness(contact: ContactData, issues: QualityIssue[]): number {
    let present = 0;
    for (const field of REQUIRED_FIELDS) {
      const value = contact[field.key];
      if (value && typeof value === 'string' && value.trim().length > 0) {
        present++;
      } else {
        issues.push({ field: field.label, issue: 'missing', severity: 'warning' });
      }
    }
    return Math.round((present / REQUIRED_FIELDS.length) * 100);
  }

  private scoreAccuracy(contact: ContactData, issues: QualityIssue[]): number {
    let checks = 0;
    let passed = 0;

    if (contact.email) {
      checks++;
      const isPlaceholder = PLACEHOLDER_VALUES.includes(contact.email.toLowerCase());
      if (EMAIL_REGEX.test(contact.email) && !isPlaceholder) {
        passed++;
      } else {
        issues.push({ field: 'email', issue: 'invalid_format', severity: 'error' });
      }
    }

    if (contact.phone) {
      checks++;
      if (PHONE_E164_REGEX.test(contact.phone)) {
        passed++;
      } else {
        issues.push({ field: 'phone', issue: 'not_e164_format', severity: 'warning' });
      }
    }

    if (checks === 0) return 100;
    return Math.round((passed / checks) * 100);
  }

  private scoreFreshness(contact: ContactData): number {
    const daysOld = (Date.now() - new Date(contact.updatedAt).getTime()) / 86400000;
    if (daysOld <= 30) return 100;
    if (daysOld >= 180) return 0;
    return Math.round(100 * (1 - (daysOld - 30) / 150));
  }
}
```

**Step 4: Run test, verify pass**

Run: `cd packages/domains/revops-domain && pnpm test -- --run data-quality-service`

**Step 5: Add export, build, commit**

Add `export * from './data-quality-service.js';` to `services/index.ts`.

```bash
cd packages/domains/revops-domain && pnpm build
git add packages/domains/revops-domain/src/services/data-quality-service*
git add packages/domains/revops-domain/src/services/index.ts
git commit -m "feat(revops-domain): add DataQualityService with 4-dimension scoring"
```

---

### Task 2.4: Create Intent Signal Repository + Routes

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/intent-signal-repository.ts`
- Create: `workers/revops/src/interface/signal-routes.ts`
- Modify: `workers/revops/src/app.tsx`

**Step 1: Write repository**

Follow the pattern from `deal-health-cache-repository.ts`. Functions:
- `findSignalsByContact(db, orgId, contactId, options?: { since?: Date })` — returns rows ordered by `occurred_at` DESC
- `findSignalsByDeal(db, orgId, dealId)` — returns rows for a deal
- `createSignal(db, orgId, data)` — inserts a new signal

**Step 2: Write API routes**

```typescript
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findSignalsByContact, findSignalsByDeal, createSignal } from '../infrastructure/repositories/intent-signal-repository.js';

export const signalRoutes = new Hono<Env>();

signalRoutes.get('/api/v1/revops/signals', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const contactId = c.req.query('contactId');
  const dealId = c.req.query('dealId');

  try {
    const signals = dealId
      ? await findSignalsByDeal(db, tenant.organizationId, dealId)
      : contactId
        ? await findSignalsByContact(db, tenant.organizationId, contactId)
        : [];
    return c.json({ items: signals });
  } catch (error) {
    console.error('List signals error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list signals' }, 500);
  }
});

signalRoutes.post('/api/v1/revops/signals', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const signal = await createSignal(db, tenant.organizationId, body);
    return c.json(signal, 201);
  } catch (error) {
    console.error('Create signal error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create signal' }, 500);
  }
});
```

**Step 3: Mount in app.tsx**

Import and mount `signalRoutes`.

**Step 4: Commit**

```bash
git add workers/revops/src/infrastructure/repositories/intent-signal-repository.ts \
       workers/revops/src/interface/signal-routes.ts \
       workers/revops/src/app.tsx
git commit -m "feat(revops): add intent signal repository and API routes"
```

---

### Task 2.5: Create Intent Signals View Fragment

**Files:**
- Create: `workers/revops/src/views/intent-signals-panel.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx` (replace stub)

**Step 1: Write the panel view**

```typescript
import type { FC } from 'hono/jsx';
import { IntentSignalService } from '@mauntic/revops-domain';

// Re-use domain types
const service = new IntentSignalService();

const TIER_STYLES: Record<string, { icon: string; color: string }> = {
  active_buying: { icon: '🔥', color: 'text-red-600' },
  hot: { icon: '🔥', color: 'text-orange-500' },
  warm: { icon: '⚡', color: 'text-yellow-500' },
  cold: { icon: '❄️', color: 'text-blue-400' },
};

export interface IntentSignalsPanelProps {
  signals: Array<{
    signal_type: string;
    strength: string;
    occurred_at: Date;
    source: string;
    metadata: Record<string, unknown> | null;
  }>;
  dealId: string;
}

export const IntentSignalsPanel: FC<IntentSignalsPanelProps> = ({ signals, dealId }) => {
  const now = new Date();
  const domainSignals = signals.map((s) => ({
    signalType: s.signal_type,
    strength: Number(s.strength),
    occurredAt: new Date(s.occurred_at),
    source: s.source,
  }));

  const agg = service.aggregateForDeal(domainSignals, now);
  const tier = TIER_STYLES[agg.tier] ?? TIER_STYLES.cold;

  const activeSignals = signals
    .map((s) => ({
      ...s,
      effective: service.getEffectiveStrength(
        { signalType: s.signal_type, strength: Number(s.strength), occurredAt: new Date(s.occurred_at), source: s.source },
        now,
      ),
    }))
    .filter((s) => s.effective > 0)
    .sort((a, b) => b.effective - a.effective);

  if (activeSignals.length === 0) {
    return <div id="intent-signals-panel" />;
  }

  return (
    <div id="intent-signals-panel" class="rounded-xl border border-gray-200 bg-white p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-900">Intent Signals</h3>
        <span class={`text-sm font-medium ${tier.color}`}>{tier.icon} {agg.tier.replace(/_/g, ' ')}</span>
      </div>
      <p class="text-xs text-gray-500 mb-3">{agg.activeCount} active signals</p>
      <div class="space-y-2">
        {activeSignals.slice(0, 5).map((s) => (
          <div class="flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-700 truncate">{s.signal_type.replace(/_/g, ' ')}</p>
            </div>
            <div class="w-20 bg-gray-200 rounded-full h-1.5">
              <div
                class="bg-brand-500 h-1.5 rounded-full"
                style={`width: ${Math.round(s.effective * 100)}%`}
              />
            </div>
            <span class="text-xs text-gray-400 w-8 text-right">{s.effective.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Step 2: Wire into view-routes.tsx**

Replace the stub `/app/revops/deals/:dealId/signals` route with one that fetches signals from the repository and renders `IntentSignalsPanel`.

**Step 3: Commit**

```bash
git add workers/revops/src/views/intent-signals-panel.tsx workers/revops/src/interface/view-routes.tsx
git commit -m "feat(revops): add intent signals panel with decay visualization"
```

---

### Task 2.6: Create Data Quality View Fragment + Repository

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/quality-score-repository.ts`
- Create: `workers/revops/src/views/quality-panel.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

Follow the same pattern as Task 2.4 and 2.5:
1. Repository: `findQualityByContact(db, orgId, contactId)`, `upsertQuality(db, orgId, contactId, scores)`
2. Panel view: Shows 4-dimension bars + issues list
3. Wire route `/app/revops/contacts/:contactId/quality` in view-routes

**Commit**

```bash
git commit -m "feat(revops): add data quality panel with 4-dimension breakdown"
```

---

### Task 2.7: Auto-Generate Signals from Activities

**Files:**
- Modify: `workers/revops/src/interface/agent-routes.ts` (activity creation endpoint)

**Step 1: After creating an activity, auto-create a matching intent signal**

In the `POST /api/v1/revops/activities` handler, after `createActivity()` succeeds, add:

```typescript
// Auto-generate intent signal from activity
const signalTypeMap: Record<string, string> = {
  email: 'email_open',
  call: 'meeting_completed',
  meeting: 'meeting_completed',
  demo: 'meeting_completed',
  linkedin: 'social_engagement',
  sms: 'email_reply',
};

const signalType = signalTypeMap[body.type];
if (signalType && body.contactId) {
  await createSignal(db, tenant.organizationId, {
    contact_id: body.contactId,
    deal_id: body.dealId ?? null,
    signal_type: signalType,
    source: 'crm',
    strength: '0.7',
    occurred_at: new Date(),
  });
}
```

**Step 2: Commit**

```bash
git add workers/revops/src/interface/agent-routes.ts
git commit -m "feat(revops): auto-generate intent signals from activity creation"
```

---

### Task 2.8: Update Pipeline Cards with Intent + DQ Indicators

**Files:**
- Modify: `workers/revops/src/views/deal-pipeline.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

**Step 1: Extend PipelineBoardProps** to include intent aggregation and quality data per deal.

**Step 2: Add to deal card** in pipeline view: intent tier badge and DQ % with warning icon.

**Step 3: Update pipeline route** to query intent signals and quality scores, compute aggregations, pass to view.

**Step 4: Deploy and verify**

**Step 5: Commit**

```bash
git commit -m "feat(revops): add intent and DQ indicators to pipeline deal cards"
```

---

## Phase 3: Buying Committee + Conversation Intelligence

### Task 3.1: Add buying_committee_members and conversation_analyses Tables

**Files:**
- Modify: `packages/domains/revops-domain/drizzle/schema.ts`

Add both tables following the design doc schema definitions. Generate migration, build, apply.

**Commit**: `feat(revops-domain): add buying_committee_members and conversation_analyses tables`

---

### Task 3.2: Create Buying Committee Service

**Files:**
- Create: `packages/domains/revops-domain/src/services/buying-committee-service.ts`
- Create: `packages/domains/revops-domain/src/services/buying-committee-service.test.ts`

**Test cases:**
- `getCoverage` returns mapped/missing roles and coverage fraction
- `getCoverage` with no members returns 0/8 coverage
- Role validation rejects invalid roles

**Implementation:** Pure domain service with:
- `VALID_ROLES` array
- `getCoverage(members)` — returns mapped roles, missing roles, coverage string
- `validateRole(role)` — returns boolean

**Commit**: `feat(revops-domain): add BuyingCommitteeService with coverage analysis`

---

### Task 3.3: Create Buying Committee Repository + Routes + View

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/committee-repository.ts`
- Create: `workers/revops/src/interface/committee-routes.ts`
- Create: `workers/revops/src/views/buying-committee-panel.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`
- Modify: `workers/revops/src/app.tsx`

Repository functions: `findByDeal`, `addMember`, `removeMember`

API routes:
- `GET /api/v1/revops/deals/:id/committee`
- `POST /api/v1/revops/deals/:id/committee`
- `DELETE /api/v1/revops/deals/:id/committee/:memberId`

View panel: Shows mapped roles with names, hollow diamonds for missing roles, coverage fraction, "+ Add Member" button.

Replace stub route in view-routes.tsx.

**Commit**: `feat(revops): add buying committee panel with CRUD and coverage`

---

### Task 3.4: Create Conversation Analyzer Service

**Files:**
- Create: `packages/domains/revops-domain/src/services/conversation-analyzer.ts`
- Create: `packages/domains/revops-domain/src/services/conversation-analyzer.test.ts`

**Test cases:**
- Returns structured analysis with all required fields
- Handles empty transcript gracefully

**Implementation:** Uses `LLMProvider` interface (same as email copilot).
- `analyze(transcript, context)` → calls LLM with structured prompt, parses response into `ConversationAnalysis` interface

**Commit**: `feat(revops-domain): add ConversationAnalyzer service with LLM-powered analysis`

---

### Task 3.5: Create Conversation Analysis View Fragment

**Files:**
- Create: `workers/revops/src/infrastructure/repositories/conversation-analysis-repository.ts`
- Create: `workers/revops/src/views/conversation-analysis.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

Inline analysis on activity timeline entries for calls/meetings. Shows sentiment bar, topic tags, objection badges.

**Commit**: `feat(revops): add conversation intelligence inline on activity timeline`

---

### Task 3.6: Update Pipeline Cards with Committee Coverage

**Modify pipeline view** to show committee diamond indicators on deal cards.

**Commit**: `feat(revops): add buying committee coverage to pipeline cards`

---

## Phase 4: Forecasts + Prospects + Sequences + Contact Intelligence

### Task 4.1: Build Forecasts Dashboard View

**Files:**
- Create: `workers/revops/src/views/forecasts-dashboard.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

KPI cards, pipeline by stage bars, deal health distribution, attention required list, rep performance table. Uses existing `forecast-routes.ts` API + deal health cache.

**Commit**: `feat(revops): add forecasts dashboard with health distribution and attention list`

---

### Task 4.2: Rebuild Prospects Page with Intelligence

**Files:**
- Modify: `workers/revops/src/views/prospect-list.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

Two sections (Needs Qualification / Recently Qualified), intent + DQ columns, smart action buttons.

**Commit**: `feat(revops): rebuild prospects page with intent and DQ intelligence`

---

### Task 4.3: Build Sequences Page

**Files:**
- Create: `workers/revops/src/views/sequence-list.tsx`
- Modify: `workers/revops/src/interface/view-routes.tsx`

List view with reply rate, status badges, enrollment quality gate warning.

**Commit**: `feat(revops): add sequences list page with quality gate warnings`

---

### Task 4.4: Enrich Contact Detail with Intelligence Tabs

**Files:**
- Modify: `workers/crm/src/views/contacts/detail.tsx` (add Deals + Intelligence tabs)
- Modify: `workers/crm/src/interface/view-routes.tsx` (add new tab values)
- Add view routes in revops worker for `/app/revops/contacts/:id/deals` and `/app/revops/contacts/:id/intelligence`

CRM renders tabs, intelligence content lazy-loaded from revops worker via HTMX.

**Commit**: `feat(crm+revops): add Deals and Intelligence tabs to contact detail`

---

### Task 4.5: Add Contact Header Intelligence Badges

**Files:**
- Modify: `workers/crm/src/views/contacts/detail.tsx`

Add lead score, intent tier badge, and DQ % to the contact header. These read from existing CRM fields (`lead_score`, `intent_score`, `data_quality_score`) which get updated via events from revops.

**Commit**: `feat(crm): add intelligence badges to contact detail header`

---

### Task 4.6: Final Deployment and Verification

**Step 1: Build all packages**

```bash
cd packages/domains/revops-domain && pnpm build
cd ../../packages/ui-kit && pnpm build
cd ../../packages/worker-lib && pnpm build
```

**Step 2: Deploy all affected workers**

```bash
cd workers/gateway && npx wrangler deploy
cd ../revops && npx wrangler deploy
cd ../crm && npx wrangler deploy
```

**Step 3: End-to-end verification**

1. Sidebar shows Revenue with 5 sub-pages
2. Pipeline board shows deals with health dots, intent badges, DQ %, committee coverage
3. Deal detail shows NBA, health, signals, committee, research, activity timeline with conversation intelligence
4. Prospects page shows smart qualification queue
5. Sequences page shows list with quality gates
6. Forecasts page shows KPIs, health distribution, attention list
7. Contact detail shows Deals + Intelligence tabs with cross-worker composition

**Commit**: `feat: complete revenue intelligence layer deployment`
