# Leads Integration Design — Mauntic3

**Date**: 2026-02-18
**Status**: Approved
**Author**: Claude + User

## Overview

Integrate all features from the Leads project (lead enrichment, intent signals, scoring, AI agents, revenue orchestration) into Mauntic3 as a full TypeScript rewrite. This creates a unified marketing automation + sales intelligence platform.

## Decisions

- **Language**: Full TypeScript rewrite (no Python services)
- **Architecture**: 3 new bounded contexts (Approach A)
- **AI Backend**: Pluggable LLM provider interface (Claude, OpenAI, etc.)
- **Enrichment Providers**: Real API integrations from day one
- **Priority**: All features, sequenced logically (enrichment → scoring → revops)

---

## Architecture

### New Bounded Contexts (3)

| Context | Domain Package | Worker (CF) | Fly.io Service | DB Schema |
|---------|---------------|-------------|----------------|-----------|
| Lead Intelligence | `lead-intelligence-domain` | `workers/lead-intelligence` | `services/enrichment-engine` | `lead_intelligence` |
| Scoring & Intent | `scoring-domain` | `workers/scoring` | `services/scoring-engine` | `scoring` |
| Revenue Operations | `revops-domain` | `workers/revops` | `services/revops-engine` | `revops` |

### Cross-Context Event Flow

```
Content (FormSubmitted, PageVisited)  ──┐
Delivery (MessageOpened, Clicked)     ──┤
Journey (StepExecuted)                ──┼──► Scoring & Intent ──► LeadScoredEvent
CRM (ContactCreated, Updated)         ──┤                         IntentSignalDetected
Lead Intelligence (LeadEnriched)      ──┘                              │
                                                                       ▼
                                                            Journey (score triggers)
                                                            Campaign (score filters)
                                                            RevOps (routing, alerts)
```

The CRM Contact remains the source-of-truth entity. Other contexts reference it via `ContactId`. No entity duplication.

---

## Context 1: Lead Intelligence

### Purpose

Owns data enrichment — fetching external data about contacts/companies, managing provider health, resolving conflicts, tracking data quality.

### Domain Entities

**EnrichmentProvider** (value object)
- `providerId`, `name`, `supportedFields[]`, `priority`, `costPerLookup`, `avgLatencyMs`, `successRate`, `batchSupported`

**EnrichmentJob** (aggregate root)
- `jobId`, `contactId`, `organizationId`
- `status`: pending | running | completed | failed | exhausted
- `fieldRequests[]` — which fields to enrich (email, phone, company, title, etc.)
- `results[]` — per-field: provider, value, confidence (0-1), cost, latency
- `totalCost`, `totalLatencyMs`, `providersTried[]`

**WaterfallConfig** (per-org configurable)
- Per field: ordered provider list, max attempts, timeout, min confidence, cache TTL, max cost

**ProviderHealth** (circuit breaker)
- `providerId`, `successCount`, `failureCount`, `lastFailure`, `state`: closed | open | half-open

**DataQualityScore** (value object per contact)
- `completeness` (0-1), `accuracy` (0-1), `freshness` (0-1), `overall` (0-1)

### Services

**EnrichmentOrchestrator** (Fly.io)
- Executes waterfall: tries providers in priority order per field
- Circuit breaker: skips unhealthy providers
- Caching: checks cache before calling provider
- Cost guard: stops if max cost exceeded
- Publishes `LeadEnrichedEvent`

**DataQualityService**
- Calculates completeness, accuracy, freshness per contact
- Publishes `DataQualityChangedEvent`

### Provider Adapters (real integrations)

Clearbit, Apollo, ZoomInfo, Hunter, RocketReach, Lusha — each implements:

```typescript
interface EnrichmentProviderAdapter {
  readonly providerId: string
  readonly supportedFields: readonly string[]
  enrich(contact: EnrichmentRequest): Promise<EnrichmentResult>
  enrichBatch?(contacts: EnrichmentRequest[]): Promise<EnrichmentResult[]>
  healthCheck(): Promise<boolean>
}
```

Default provider priority:
- **Email**: Clearbit → Apollo → Hunter
- **Phone**: ZoomInfo → Lusha → RocketReach
- **Company**: Clearbit → ZoomInfo
- **Tech Stack**: BuiltWith → Wappalyzer

### API Endpoints (CF Worker)

- `POST /contacts/:id/enrich` — trigger enrichment
- `POST /contacts/enrich/batch` — batch enrichment
- `GET /enrichment/providers` — list configured providers
- `PUT /enrichment/config` — update waterfall config
- `GET /enrichment/health` — provider health dashboard
- `GET /contacts/:id/enrichment-history` — audit trail

### CRM Integration

Enriched fields written to Contact `customFields` JSONB. New columns on contacts table:
- `enrichmentStatus` (pending | completed | failed)
- `lastEnrichedAt` (timestamp)
- `dataQualityScore` (numeric 0-1)

---

## Context 2: Scoring & Intent

### Purpose

Owns lead scoring (behavioral + firmographic + intent), intent signal detection, signal decay, and score-based alerting.

### Domain Entities

**LeadScore** (aggregate root)
- `contactId`, `organizationId`
- `totalScore` (0-100), `grade` (A/B/C/D/F)
- Components: `engagementScore`, `fitScore`, `intentScore`, `dataQualityScore`
- `scoredAt`, `previousScore`, `scoreChange`
- `topContributors[]` — explainable factors

**ScoringModel** (strategy pattern)

```typescript
interface ScoringModel {
  readonly modelId: string
  readonly version: string
  score(features: ScoringFeatures): { score: number; confidence: number; contributors: ScoreContributor[] }
}
```

Implementations: `RuleBasedScorer` (default). Per-org configurable weights.

Default weights:
- Contact info: has_email +10, has_phone +15, has_direct_phone +10
- Company fit: SMB +5, mid-market +10, enterprise +15
- Seniority: C-level +20, VP +15, director +10, manager +5
- Engagement: high (>5 visits) +15, medium (2-5) +10, content download +10
- Intent: pricing page +20, demo request +30, free trial +25

**IntentSignal** (value object)
- `signalType` (44 types — see appendix)
- `source`, `weight` (0-1), `detectedAt`, `expiresAt`
- `decayModel`: linear | exponential
- `category`: first_party | third_party

Signal categories:
- **First-party** (fast decay 1-14d): demo_request, pricing_page, trial_signup, contact_page, content_download, email_reply, website_visit
- **Third-party** (slow decay 30-90d): funding_round, job_change, tech_install, g2_research, hiring_spree

**ScoreHistory** — daily snapshots for trend analysis

### Services

**ScoringEngine** (Fly.io — BullMQ scheduled job, hourly)
- Collects features: CRM data (fit), analytics events (engagement), intent signals
- Applies scoring model
- Detects threshold crossings
- Publishes `LeadScoredEvent`, `ScoreThresholdCrossedEvent`

**SignalDetector** (CF Worker — real-time)
- Listens to events: PageVisited, FormSubmitted, MessageOpened, MessageClicked, AssetDownloaded
- Maps events to signal types using configurable rules
- Deduplication within configurable window (default 1h)
- Publishes `IntentSignalDetectedEvent`

**SignalRouter**
- CRITICAL (demo_request, pricing_page) → 1h SLA alert
- HIGH (funding_round, g2_research) → 4h SLA alert
- MEDIUM (content_download, webinar) → 24h SLA alert
- Publishes `SignalAlertCreatedEvent`

### API Endpoints (CF Worker)

- `GET /contacts/:id/score` — current score with breakdown
- `GET /contacts/:id/score/history` — trend over time
- `GET /contacts/:id/signals` — active intent signals
- `POST /scoring/recalculate` — trigger batch rescoring
- `PUT /scoring/config` — update scoring weights
- `GET /scoring/leaderboard` — top contacts by score
- `GET /signals/alerts` — pending alerts with SLA status

### Intent Tiers

| Score | Tier | SLA | Action |
|-------|------|-----|--------|
| 90-100 | HOT | 1h | Immediate outreach |
| 75-89 | WARM | 4h | Prioritized follow-up |
| 50-74 | MEDIUM | 24h | Standard outreach |
| 25-49 | COOL | 72h | Nurture sequence |
| 0-24 | COLD | N/A | Long-term nurture |

---

## Context 3: Revenue Operations

### Purpose

Owns sales execution — deal pipeline, forecasting, lead routing, workflow automation, and AI-powered agents.

### Domain Entities

**Deal** (aggregate root)
- `dealId`, `accountId` (company), `contactId`, `organizationId`
- `stage`: prospecting (10%) → qualification (20%) → discovery (30%) → demo (50%) → proposal (75%) → negotiation (90%) → closed_won (100%) | closed_lost (0%)
- `dealValue`, `probability`, `priority` (low/medium/high/critical)
- `assignedRep`, `expectedCloseAt`, `closedAt`
- `activities[]`, `notes[]`

**Activity** (value object)
- `type`: call | email | meeting | demo | task | note | linkedin | sms
- `contactId`, `dealId`, `timestamp`, `outcome`, `duration`, `notes`

**Forecast** (aggregate)
- `period`, `repId`, `organizationId`
- Categories: pipeline, best_case, commit, closed, omitted
- `weightedTotal` = closed×1.0 + commit×1.0 + best_case×0.5 + pipeline×0.25

**RoutingRule** (per-org)
- `strategy`: round_robin | weighted | territory | skill_based | load_balanced
- `conditions` (industry, company size, score range, geography)
- `targetReps[]`

**Sequence** (SDR)
- `sequenceId`, `name`, `steps[]` (up to 8)
- Step types: email, linkedin_connect, linkedin_message, sms, phone_call, wait
- A/B variants per step
- Daily limits: 100 emails, 50 LinkedIn, 25 SMS

**Prospect** (SDR qualification)
- `contactId`, `qualificationScore`, `reasoning`
- `icpMatch` (title, company size, industry)
- `recommendedAction`: enrich | sequence | skip | manual_review

### AI Agents

**LLM Provider Interface** (pluggable):

```typescript
interface LLMProvider {
  complete(prompt: string, options: LLMOptions): Promise<LLMResponse>
  stream(prompt: string, options: LLMOptions): AsyncIterable<string>
}
// Implementations: ClaudeLLMProvider, OpenAILLMProvider
```

**Research Agent**
- Company research: profile, funding, tech stack, hiring, news
- Person research: LinkedIn profile, publications, shared connections
- Personalization insights (14 types) with quality scoring (relevance × freshness × uniqueness)

**SDR Agent** (3 modes)
- **Autopilot**: fully autonomous qualification + sequencing
- **Copilot**: suggests actions, human approves high-value leads
- **Learning**: shadow mode, observes without executing
- Qualification: ICP matching + score thresholds + data completeness
- Response handling: sentiment analysis, intent classification, auto-suggest replies

**Deal Inspector**
- Analyzes deal health: activity recency, stage velocity, engagement signals
- Flags at-risk deals (stale, slowing velocity, champion left)

**Sales Coach**
- Reviews email drafts and call notes
- Suggests improvements based on deal context and buyer signals

**Email Copilot**
- Generates personalized outreach using research insights
- A/B subject line generation
- Token substitution ({{first_name}}, {{company}}, etc.)

### Workflow Engine

Triggers: deal_created, stage_changed, deal_won/lost, inactivity, score_changed, time_in_stage

Actions: send_email, create_task, update_field, assign_owner, notify, call_webhook, add_to_sequence, move_stage

### API Endpoints (CF Worker)

- Deals: CRUD + stage transitions + activity logging
- Forecasting: `GET /forecast/:period`, `PUT /forecast/commit`
- Routing: `POST /leads/route`, `PUT /routing/rules`
- SDR: `POST /prospects/qualify`, `GET /sequences`, `POST /sequences/:id/enroll`
- Research: `POST /contacts/:id/research`, `GET /contacts/:id/insights`
- Agents: `POST /agents/research/run`, `POST /agents/sdr/qualify`

### Fly.io Services (BullMQ workers)

- `research-worker` — AI research jobs
- `sdr-worker` — sequence execution, response handling
- `routing-worker` — lead routing rules
- `forecast-worker` — pipeline forecast aggregation
- `workflow-worker` — automation workflow execution

---

## Modifications to Existing Contexts

### CRM Domain

New columns on `contacts` table (denormalized projections):
- `leadScore` (numeric), `leadGrade` (varchar), `intentScore` (numeric)
- `enrichmentStatus` (varchar), `lastEnrichedAt` (timestamp), `dataQualityScore` (numeric)

Updated via event handlers for `LeadScoredEvent` and `LeadEnrichedEvent`.

### Journey Domain

New trigger types:
- `score_threshold` — fires when contact score crosses a value
- `intent_signal` — fires on specific signal types

New split conditions:
- `score_range` — route by score band
- `lead_grade` — route by A/B/C/D/F

### Campaign Domain

- Segment queries gain `minScore`, `maxScore`, `grade` filter parameters
- Campaign targeting can exclude contacts below a score threshold

### Analytics Domain

New aggregation tables:
- `dailyScoreDistribution` (date, avg, min, max, p50, p90, p95)
- `engagementCohorts` (date, grade, count, avg_open_rate, avg_click_rate)
- `scoreTrends` (contact_id, days_ago, score_value)
- `enrichmentMetrics` (date, total_enriched, success_rate, avg_freshness)

### Integrations Domain

- Enrichment provider API keys stored as Integration Connections
- CRM sync enhanced to push lead_score to Salesforce/HubSpot

---

## New Domain Events

### Lead Intelligence
- `LeadEnrichedEvent` { contactId, changedFields[], source, confidence }
- `EnrichmentFailedEvent` { contactId, provider, reason }
- `DataQualityChangedEvent` { contactId, oldScore, newScore }

### Scoring & Intent
- `LeadScoredEvent` { contactId, score, grade, previousScore, topContributors[] }
- `ScoreThresholdCrossedEvent` { contactId, threshold, direction: up | down }
- `IntentSignalDetectedEvent` { contactId, signalType, weight, source }
- `SignalAlertCreatedEvent` { contactId, priority, deadline, signalType }

### Revenue Operations
- `DealCreatedEvent` { dealId, contactId, value, stage }
- `DealStageChangedEvent` { dealId, oldStage, newStage }
- `DealWonEvent` / `DealLostEvent`
- `ProspectQualifiedEvent` { contactId, score, recommendation }
- `SequenceStepExecutedEvent` { sequenceId, contactId, stepType, outcome }
- `ResearchCompletedEvent` { contactId, insightCount, topInsight }

---

## Full Event Flow

```
                    ┌─────────────────────┐
                    │    CRM Domain       │
                    │ (Contact/Company)   │
                    └────────┬────────────┘
                             │ ContactCreated
                             ▼
                    ┌─────────────────────┐
                    │  Lead Intelligence  │──── EnrichmentProviders (API)
                    │  (Enrich + Quality) │     Clearbit, Apollo, ZoomInfo...
                    └────────┬────────────┘
                             │ LeadEnrichedEvent
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌──────────────┐  ┌──────────┐
     │  Content   │  │  Delivery    │  │ Analytics│
     │ PageVisit  │  │ EmailOpen    │  │ Aggregate│
     │ FormSubmit │  │ Click/Bounce │  │ Scores   │
     └─────┬──────┘  └──────┬───────┘  └──────────┘
           │                │
           └───────┬────────┘
                   ▼
          ┌────────────────────┐
          │  Scoring & Intent  │
          │ (Score + Signals)  │
          └────────┬───────────┘
                   │ LeadScoredEvent, IntentSignalDetected
          ┌────────┼────────┐
          ▼        ▼        ▼
     ┌─────────┐ ┌──────┐ ┌──────────────────┐
     │ Journey │ │Campgn│ │ Revenue Ops      │
     │ (score  │ │(score│ │ (routing, deals,  │
     │ trigger)│ │filter│ │  SDR, research)   │
     └─────────┘ └──────┘ └──────────────────┘
```

---

## Appendix: Signal Types (44)

### First-Party (fast decay)
| Signal | Weight | Decay | Tier |
|--------|--------|-------|------|
| DEMO_REQUEST | 1.0 | 24h | HOT |
| PRICING_PAGE | 0.9 | 72h | HOT |
| FREE_TRIAL_SIGNUP | 0.95 | 24h | HOT |
| CONTACT_PAGE | 0.8 | 48h | WARM |
| CONTENT_DOWNLOAD | 0.5 | 168h | MEDIUM |
| EMAIL_REPLY | 0.8 | 24h | WARM |
| WEBSITE_VISIT | 0.2 | 168h | COLD |
| FORM_SUBMISSION | 0.7 | 48h | WARM |
| MEETING_SCHEDULED | 0.95 | 24h | HOT |
| WEBINAR_ATTENDED | 0.6 | 168h | MEDIUM |
| CASE_STUDY_VIEW | 0.5 | 168h | MEDIUM |
| COMPARISON_PAGE | 0.7 | 120h | WARM |

### Third-Party (slow decay)
| Signal | Weight | Decay | Source |
|--------|--------|-------|--------|
| FUNDING_ROUND | 0.9 | 60d | Crunchbase |
| JOB_CHANGE | 0.8 | 30d | Apollo/LinkedIn |
| TECH_INSTALL | 0.7 | 90d | BuiltWith |
| G2_RESEARCH | 0.85 | 14d | G2 |
| HIRING_SPREE | 0.75 | 30d | LinkedIn |
| EXECUTIVE_CHANGE | 0.7 | 30d | LinkedIn |
| EXPANSION_NEWS | 0.6 | 60d | News APIs |
| PARTNERSHIP_ANNOUNCED | 0.5 | 60d | News APIs |
