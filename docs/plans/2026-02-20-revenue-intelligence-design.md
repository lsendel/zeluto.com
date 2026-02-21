# Revenue Intelligence Layer — Design Document

**Date**: 2026-02-20
**Status**: Approved
**Approach**: Intelligence Layer (Approach A) — features surface inline where decisions happen, with deep-dive tabs for power users.

## Origin

Analysis of the `/leads` data product identified six capabilities missing from Zeluto's RevOps module: data quality scoring, intent signals with decay, buying committee mapping, conversation intelligence, pipeline hooks, and quality gates. This design integrates all six as a cross-cutting intelligence layer within the existing RevOps architecture.

## Target Users

- **Sales reps / AEs**: Manage their own deals, follow up on leads, use AI coaching. Need a personal pipeline view and action queue.
- **Sales managers / VPs**: Oversee team pipeline, monitor forecasts, review deal health across reps. Need dashboards and team-wide visibility.

---

## 1. Navigation & Page Structure

RevOps enters the sidebar as a "Revenue" group:

```
Sidebar
├── Dashboard
├── Audience → Contacts
├── Marketing → Journeys, Campaigns, Content
├── Channels → Delivery
├── Revenue                  ← NEW
│   ├── Pipeline             ← landing page (kanban)
│   ├── Deals                ← list/table view
│   ├── Prospects            ← SDR qualification queue
│   ├── Sequences            ← outreach automation
│   └── Forecasts            ← manager dashboard
├── Insights → Analytics
└── Account → Settings, Billing
```

- Pipeline is the default when clicking "Revenue."
- Workflows and Routing Rules live under Settings > Revenue (admin config, not daily use).
- No separate "Intelligence" page — intelligence surfaces inline on Pipeline, Deal Detail, and Contact Detail.

---

## 2. Pipeline Board (Landing Page)

Kanban board with enriched deal cards. Each card shows five intelligence layers at a glance:

| Element | Source | Visual |
|---------|--------|--------|
| Health dot | Deal inspector (existing) | Green (healthy), yellow (at-risk), red (critical) |
| Intent signals | NEW intent signal system | Fire/bolt icon + count of active signals (7-day window) |
| Buying committee | NEW buying committee model | Diamond icons: filled = identified, hollow = missing |
| Data quality | NEW quality dimensions | Percentage + warning icon if below 70% |
| Assigned rep | Existing deal field | Name label |

### Filters
- **Rep filter**: "My Deals" (default for reps) / "All Deals" / specific rep (managers)
- **Period filter**: Quarter selector
- **"+ Deal" button**: Opens create-deal modal

### Interactions
- Click card → Deal Detail page (HTMX `hx-get` + `hx-push-url`)
- Column headers show aggregate value and deal count
- No drag-and-drop in v1 — stage changes happen in deal detail

### Data flow
Single API call returns deals + pre-computed intelligence from `deal_health_cache`. Health/intent/quality scores are pre-computed on events (activity creation, stage change), not on page load.

---

## 3. Deal Detail Page

Two-column layout. Left column (60%) is actionable content, right column (40%) is context.

### Left Column (top to bottom)
1. **Next Best Action** — AI recommendation with 3-step playbook. Action buttons: [Draft Email] (opens email copilot), [Log Call], [Dismiss].
2. **Intent Signals** — time-decaying signals with strength bars. Grouped by recency. Intent tier badge (cold/warm/hot/active buying).
3. **Data Quality** — 4-dimension breakdown (completeness, accuracy, freshness, consistency) with progress bars. Actionable "Fix Issues" link to contact edit form.
4. **Activity Timeline** — chronological feed. Calls/meetings show inline conversation intelligence (sentiment, topics, objections). "View Full Analysis" opens modal.

### Right Column (always visible)
1. **Deal Health** — score 0-100, risk level, flags, explainability link showing weighted signals.
2. **Buying Committee** — mapped roles with contact names. Unmapped roles as hollow diamonds. [+ Add Member] and [Auto-map] (LLM-powered role suggestions) buttons.
3. **Research Insights** — cached company intelligence from research agent. [Refresh] triggers new job.

### Header
- Deal name, health dot, value
- Stage progress bar (clickable stages for stage change)
- Rep name, expected close date, age

### Data loading
Progressive via HTMX — deal header + timeline load immediately, intelligence panels lazy-load in parallel:
- `/app/revops/deals/{id}/health`
- `/app/revops/deals/{id}/signals`
- `/app/revops/deals/{id}/committee`
- `/app/revops/deals/{id}/quality`
- `/app/revops/deals/{id}/research`

---

## 4. Contact Detail Enrichment

Extends the existing CRM contact detail page. No CRM schema changes — revops serves intelligence fragments via HTMX.

### Header additions
Three inline indicators: Lead Score, Intent Tier, Data Quality %.

### Overview tab enhancement
Adds "Quality Snapshot" card: 4-dimension breakdown + actionable issues. "Fix Now" navigates to edit form with problem fields highlighted.

### New tabs
- **Deals tab** — all deals for this contact with health dots, value, stage, and the contact's buying committee role per deal.
- **Intelligence tab** (deep-dive) — full intent signal history with decay, buying committee roles across all deals, research profile.

### Cross-worker composition
CRM worker renders the page shell. New panels load as HTMX fragments from the revops worker:
```
Contact Detail (CRM worker)
├── Overview → CRM worker + hx-get="/app/revops/contacts/{id}/quality"
├── Deals → hx-get="/app/revops/contacts/{id}/deals"
├── Intelligence → hx-get="/app/revops/contacts/{id}/intelligence"
└── Activity → CRM worker
    └── Call analysis → hx-get="/app/revops/activities/{id}/analysis"
```

---

## 5. Data Model

All new tables live in the `revops` schema. Nothing touches the CRM schema.

### intent_signals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | indexed |
| contact_id | uuid | |
| deal_id | uuid nullable | |
| signal_type | varchar(50) | see enumeration below |
| source | varchar(100) | "website", "email", "crm" |
| strength | numeric(3,2) | 0.00–1.00 |
| metadata | jsonb | page URL, email subject, etc. |
| occurred_at | timestamp | when the signal happened |
| created_at | timestamp | |

Indexes: `(org_id, contact_id, occurred_at)`, `(org_id, deal_id)`, `(org_id, signal_type)`

**Signal types**: `website_visit`, `content_download`, `email_open`, `email_click`, `email_reply`, `form_submission`, `webinar_attendance`, `review_site_visit`, `competitor_research`, `social_engagement`, `meeting_scheduled`, `meeting_completed`, `referral_received`, `return_visit`, `pricing_page_view`

### buying_committee_members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | |
| deal_id | uuid FK | indexed |
| contact_id | uuid | |
| role | varchar(50) | see roles below |
| influence_level | varchar(20) | high, medium, low |
| sentiment | varchar(20) | positive, neutral, negative, unknown |
| notes | text nullable | |
| created_at, updated_at | timestamp | |

Unique constraint: `(deal_id, contact_id)` — one role per person per deal.

**Roles**: `economic_buyer`, `technical_buyer`, `user_buyer`, `champion`, `coach`, `blocker`, `influencer`, `decision_maker`

### contact_quality_scores
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | |
| contact_id | uuid | |
| overall_score | numeric(5,2) | 0–100 |
| completeness | numeric(5,2) | |
| accuracy | numeric(5,2) | |
| freshness | numeric(5,2) | |
| consistency | numeric(5,2) | |
| issues | jsonb | [{field, issue, severity}] |
| computed_at | timestamp | |

Unique constraint: `(org_id, contact_id)`

### deal_health_cache
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | |
| deal_id | uuid FK unique | |
| score | integer | 0–100 |
| risk_level | varchar(20) | healthy, at_risk, critical |
| flags | jsonb | [{type, message, severity}] |
| next_action_type | varchar(50) | |
| next_action_summary | text | |
| computed_at | timestamp | |

### conversation_analyses
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | |
| activity_id | uuid FK unique | links to activities table |
| overall_sentiment | varchar(20) | positive, neutral, negative |
| sentiment_score | numeric(3,2) | -1.00 to 1.00 |
| topics | jsonb | ["budget", "timeline", ...] |
| objections | jsonb | [{text, category, handled}] |
| engagement_score | numeric(5,2) | 0–100 |
| key_moments | jsonb | [{timestamp, type, summary}] |
| coaching_notes | jsonb | [{area, suggestion}] |
| analyzed_at | timestamp | |

### Intent signal decay formula

```
effective_strength = original_strength x decay_factor

  0–3 days:   1.0
  3–7 days:   0.8
  7–14 days:  0.5
  14–30 days: 0.2
  30+ days:   0.0 (expired)
```

Intent tier (sum of effective strengths): >= 3.0 active_buying, >= 1.5 hot, >= 0.5 warm, < 0.5 cold.

### Event-driven cache updates

| Event | Triggers |
|-------|----------|
| activity.created | recompute deal_health_cache for that deal |
| deal.stage_changed | recompute deal_health_cache |
| intent_signal.created | recompute deal_health_cache if deal_id present |
| buying_committee.changed | recompute deal_health_cache |
| crm.contact_updated | recompute contact_quality_scores |
| Cron: every 6 hours | recompute all deals (time-based decay) |

---

## 6. Backend Services

All new services live in `packages/domains/revops-domain/src/services/`. All are pure functions (no DB access, no side effects).

### New services

| Service | Responsibility |
|---------|---------------|
| `intent-signal-service.ts` | Signal recording, decay computation, tier calculation, deal/contact aggregation |
| `data-quality-service.ts` | 4-dimension quality assessment against hardcoded rules |
| `buying-committee-service.ts` | CRUD, coverage analysis, LLM-powered role suggestions |
| `conversation-analyzer.ts` | LLM-powered transcript analysis (sentiment, topics, objections, coaching) |
| `deal-health-cache-service.ts` | Orchestrates cache writes by running deal-inspector + next-best-action |
| `contact-intelligence-service.ts` | Aggregates full intelligence picture for a contact |

### Quality rules (v1, hardcoded)
- **Completeness**: email, phone, first_name, last_name, title, company — equal weight
- **Accuracy**: email format, phone E.164, no placeholder values
- **Freshness**: 100% if updated < 30 days, decays to 0% at 180 days
- **Consistency**: stage vs lead_score alignment, status vs activity recency

### New routes

**API routes** (JSON):
```
POST   /api/v1/revops/signals
GET    /api/v1/revops/signals?contactId=&dealId=
GET    /api/v1/revops/deals/:id/committee
POST   /api/v1/revops/deals/:id/committee
DELETE /api/v1/revops/deals/:id/committee/:memberId
POST   /api/v1/revops/deals/:id/committee/suggest
GET    /api/v1/revops/contacts/:id/quality
POST   /api/v1/revops/contacts/:id/quality/recompute
```

**View routes** (HTML fragments for HTMX):
```
GET /app/revops/pipeline
GET /app/revops/deals
GET /app/revops/deals/:id
GET /app/revops/deals/:id/health
GET /app/revops/deals/:id/signals
GET /app/revops/deals/:id/committee
GET /app/revops/deals/:id/quality
GET /app/revops/deals/:id/research
GET /app/revops/prospects
GET /app/revops/sequences
GET /app/revops/forecasts
GET /app/revops/contacts/:id/deals
GET /app/revops/contacts/:id/intelligence
GET /app/revops/contacts/:id/quality
GET /app/revops/activities/:id/analysis
```

### Intent signal ingestion paths

1. **Manual** — rep records a signal via deal detail UI (v1)
2. **Auto from activities** — activity creation generates matching signal (v1)
3. **Webhook/API** — external tracking tools post signals (future, schema-ready)

---

## 7. Remaining Pages

### Prospects (SDR Queue)
Two sections: "Needs Qualification" and "Recently Qualified." Intent and DQ columns inline. Smart action button: if DQ < 50% shows "Enrich" instead of "Qualify." Recommendation badges link to next steps (Sequence enrollment, archive, manual review).

### Sequences
List view with reply rate metric. Sequence detail shows steps, enrollments, conversion metrics. Quality gate: warning before enrolling contacts with DQ < 70%.

### Forecasts (Manager Dashboard)
Four sections:
1. KPI cards (pipeline, weighted, win rate, avg cycle)
2. Pipeline by stage (horizontal bars, clickable)
3. Deal health distribution (healthy/at-risk/critical with dollar values, clickable)
4. Attention Required (curated list of critical/at-risk deals with specific flags)
5. Rep Performance (portfolio health, DQ average, signal density per rep)

---

## 8. Implementation Phases

### Phase 1: Pipeline Board + Deal Detail (Foundation)
- Add "Revenue" to sidebar, wire gateway routing
- Pipeline kanban with health dots from existing deal-inspector
- Deal detail: header, stage progress, activity timeline, health panel, NBA panel
- Deal CRUD (create modal, stage change)
- `deal_health_cache` table + event-driven recomputation
- **Depends on**: nothing new

### Phase 2: Data Quality + Intent Signals (Intelligence Layer)
- `intent_signals` table + service + decay computation
- Auto-generation of signals from activities
- Manual signal recording UI
- Intent badges on pipeline cards and contact headers
- `contact_quality_scores` table + service
- Quality snapshot on deal detail and contact overview
- Quality warnings on prospect queue
- **Depends on**: Phase 1

### Phase 3: Buying Committee + Conversation Intelligence
- `buying_committee_members` table + service
- Committee panel on deal detail (CRUD + Auto-map via LLM)
- Committee coverage indicator on pipeline cards
- `conversation_analyses` table + service
- Inline sentiment/topics/objections on call/meeting activities
- Full analysis modal
- **Depends on**: Phase 1, Phase 2

### Phase 4: Forecasts + Prospects + Sequences Pages
- Forecasts dashboard (KPIs, stage breakdown, health distribution, attention list, rep performance)
- Prospects page (queue with intent/DQ, smart actions)
- Sequences page (list, detail, enrollment with quality gate)
- Contact detail enrichment (Deals tab, Intelligence tab, quality snapshot)
- **Depends on**: Phases 1–3

---

## 9. Explicitly Out of Scope (v1)

- Drag-and-drop stage changes on pipeline board
- Visual sequence step builder
- Real-time updates (WebSocket/SSE)
- Territory planning
- Forecast accuracy tracking / confidence intervals
- External webhook ingestion for intent signals (schema ready, integration future)
- Raw transcript storage (only analysis output stored)
