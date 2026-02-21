import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const RevOpsDealSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  accountId: z.string().nullable(),
  name: z.string(),
  stage: z.string(),
  value: z.number(),
  probability: z.number(),
  priority: z.string(),
  assignedRep: z.string().nullable(),
  expectedCloseAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const RevOpsActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  contactId: z.string().nullable(),
  dealId: z.string().nullable(),
  outcome: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  notes: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const RevOpsForecastSchema = z.object({
  period: z.string(),
  repId: z.string().nullable(),
  pipelineValue: z.number(),
  bestCaseValue: z.number(),
  commitValue: z.number(),
  closedValue: z.number(),
  weightedValue: z.number(),
});

export const RevOpsCalibrationMetricsSchema = z.object({
  mape: z.number(),
  bias: z.number(),
  sampleSize: z.number(),
});

export const RevOpsConfidenceBandSchema = z.object({
  low: z.number(),
  mid: z.number(),
  high: z.number(),
  confidenceLevel: z.number(),
});

export const RevOpsRiskAlertSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string(),
  description: z.string(),
});

export const RevOpsCalibrationReportSchema = z.object({
  metrics: RevOpsCalibrationMetricsSchema,
  confidenceBand: RevOpsConfidenceBandSchema,
  alerts: z.array(RevOpsRiskAlertSchema),
});

export const RevOpsProspectSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  qualificationScore: z.number(),
  icpMatch: z.number(),
  recommendation: z.string(),
  dataCompleteness: z.number(),
  qualifiedAt: z.string().nullable(),
});

export const RevOpsSequenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  stepCount: z.number(),
  status: z.string(),
  createdAt: z.string(),
});

export const RevOpsInsightSchema = z.object({
  insightType: z.string(),
  content: z.string(),
  relevance: z.number(),
  freshness: z.number(),
  source: z.string().nullable(),
});

export const RevOpsPipelineMetricsSchema = z.object({
  totalDeals: z.number(),
  totalValue: z.number(),
  avgDealSize: z.number(),
  stageBreakdown: z.record(z.string(), z.number()),
  winRate: z.number(),
});

export const RevOpsExplainabilitySignalSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  impact: z.enum(['positive', 'negative', 'neutral']),
  weight: z.number(),
  reason: z.string(),
});

export const RevOpsExplainabilityTrailSchema = z.object({
  summary: z.string(),
  confidence: z.number(),
  generatedAt: z.string(),
  signals: z.array(RevOpsExplainabilitySignalSchema),
});

export const RevOpsDealHealthSchema = z.object({
  dealId: z.string(),
  riskLevel: z.enum(['healthy', 'at_risk', 'critical']),
  flags: z.array(z.string()),
  recommendations: z.array(z.string()),
  score: z.number(),
});

export const RevOpsNextBestActionSchema = z.object({
  type: z.enum([
    'rescue_call',
    'reengagement_sequence',
    'discovery_meeting',
    'mutual_action_plan',
    'close_plan_review',
    'none',
  ]),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  title: z.string(),
  reason: z.string(),
  dueInHours: z.number(),
  playbook: z.array(z.string()),
});

export const RevOpsNextBestActionResponseSchema = z.object({
  dealId: z.string(),
  action: RevOpsNextBestActionSchema,
  risk: z.object({
    level: z.enum(['healthy', 'at_risk', 'critical']),
    score: z.number(),
    flags: z.array(z.string()),
  }),
  explainability: RevOpsExplainabilityTrailSchema,
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const revopsContract = c.router(
  {
    // Deals
    getDeal: {
      method: 'GET',
      path: '/deals/:dealId',
      responses: {
        200: RevOpsDealSchema,
        404: z.object({ error: z.string() }),
      },
      summary: 'Get a deal',
    },
    listDeals: {
      method: 'GET',
      path: '/deals',
      query: z.object({
        stage: z.string().optional(),
        assignedRep: z.string().optional(),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(RevOpsDealSchema),
      },
      summary: 'List deals',
    },
    createDeal: {
      method: 'POST',
      path: '/deals',
      body: z.object({
        contactId: z.string().uuid(),
        name: z.string(),
        value: z.number().optional(),
        priority: z.string().optional(),
        accountId: z.string().uuid().optional(),
        assignedRep: z.string().uuid().optional(),
      }),
      responses: {
        201: RevOpsDealSchema,
      },
      summary: 'Create a deal',
    },
    updateDealStage: {
      method: 'PUT',
      path: '/deals/:dealId/stage',
      body: z.object({
        stage: z.string(),
        lostReason: z.string().optional(),
      }),
      responses: {
        200: RevOpsDealSchema,
        404: z.object({ error: z.string() }),
      },
      summary: 'Update deal stage',
    },

    // Activities
    logActivity: {
      method: 'POST',
      path: '/activities',
      body: z.object({
        type: z.string(),
        contactId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        outcome: z.string().optional(),
        durationMinutes: z.number().optional(),
        notes: z.string().optional(),
      }),
      responses: {
        201: RevOpsActivitySchema,
      },
      summary: 'Log an activity',
    },

    // Forecasting
    getForecast: {
      method: 'GET',
      path: '/forecasts/:period',
      query: z.object({
        repId: z.string().optional(),
      }),
      responses: {
        200: RevOpsForecastSchema,
        404: z.object({ error: z.string() }),
      },
      summary: 'Get forecast for a period',
    },

    // Forecast calibration
    getForecastCalibration: {
      method: 'GET',
      path: '/forecasts/:period/calibration',
      responses: {
        200: RevOpsCalibrationReportSchema,
        404: z.object({ error: z.string() }),
      },
      summary: 'Get forecast calibration report with confidence bands and accuracy metrics',
    },
    getForecastRiskAlerts: {
      method: 'GET',
      path: '/forecasts/:period/risk-alerts',
      responses: {
        200: z.object({
          period: z.string(),
          alerts: z.array(RevOpsRiskAlertSchema),
        }),
        404: z.object({ error: z.string() }),
      },
      summary: 'Get active risk alerts for a forecast period',
    },

    // Pipeline metrics
    getPipelineMetrics: {
      method: 'GET',
      path: '/pipeline/metrics',
      query: z.object({
        period: z.string().optional(),
      }),
      responses: {
        200: RevOpsPipelineMetricsSchema,
      },
      summary: 'Get pipeline metrics',
    },

    // AI Assist
    getNextBestAction: {
      method: 'GET',
      path: '/agents/next-best-action/:dealId',
      query: z.object({
        now: z.string().optional(),
      }),
      responses: {
        200: RevOpsNextBestActionResponseSchema,
        400: z.object({ code: z.string(), message: z.string() }),
        404: z.object({ code: z.string(), message: z.string() }),
      },
      summary: 'Get next best action recommendation for a deal',
    },
    getDealExplainability: {
      method: 'GET',
      path: '/agents/deal-inspector/:dealId/explainability',
      query: z.object({
        now: z.string().optional(),
      }),
      responses: {
        200: z.object({
          dealId: z.string(),
          report: RevOpsDealHealthSchema,
          explainability: RevOpsExplainabilityTrailSchema,
        }),
        400: z.object({ code: z.string(), message: z.string() }),
        404: z.object({ code: z.string(), message: z.string() }),
      },
      summary: 'Get explainability trail for deal health and recommendation',
    },

    // Prospects / SDR
    listProspects: {
      method: 'GET',
      path: '/prospects',
      query: z.object({
        recommendation: z.string().optional(),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(RevOpsProspectSchema),
      },
      summary: 'List prospects',
    },
    qualifyProspect: {
      method: 'POST',
      path: '/prospects/:contactId/qualify',
      body: z.object({}),
      responses: {
        200: RevOpsProspectSchema,
      },
      summary: 'Qualify a prospect',
    },

    // Sequences
    listSequences: {
      method: 'GET',
      path: '/sequences',
      query: z.object({
        status: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(RevOpsSequenceSchema),
      },
      summary: 'List sequences',
    },
    createSequence: {
      method: 'POST',
      path: '/sequences',
      body: z.object({
        name: z.string(),
        steps: z
          .array(
            z.object({
              type: z.string(),
              delayDays: z.number(),
              subject: z.string().optional(),
              body: z.string().optional(),
            }),
          )
          .optional(),
      }),
      responses: {
        201: RevOpsSequenceSchema,
      },
      summary: 'Create a sequence',
    },
    enrollSequence: {
      method: 'POST',
      path: '/sequences/:sequenceId/enroll',
      body: z.object({
        contactId: z.string().uuid(),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
      summary: 'Enroll a contact in a sequence',
    },

    // Research
    runResearch: {
      method: 'POST',
      path: '/research',
      body: z.object({
        contactId: z.string().uuid(),
        type: z.enum(['company', 'person']),
      }),
      responses: {
        202: z.object({ jobId: z.string(), message: z.string() }),
      },
      summary: 'Start a research job',
    },
    getInsights: {
      method: 'GET',
      path: '/contacts/:contactId/insights',
      query: z.object({
        insightType: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(RevOpsInsightSchema),
      },
      summary: 'Get research insights for a contact',
    },
  },
  {
    pathPrefix: '/api/v1/revops',
    strictStatusCodes: true,
  },
);
