import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const LeadScoreSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  totalScore: z.number(),
  grade: z.string(),
  engagementScore: z.number(),
  fitScore: z.number(),
  intentScore: z.number(),
  components: z.record(z.number()).nullable(),
  topContributors: z.array(z.object({ factor: z.string(), points: z.number() })).nullable(),
  scoredAt: z.string(),
});

export const ScoreHistoryEntrySchema = z.object({
  date: z.string(),
  totalScore: z.number(),
  engagementScore: z.number(),
  fitScore: z.number(),
  intentScore: z.number(),
});

export const IntentSignalSchema = z.object({
  id: z.string(),
  signalType: z.string(),
  source: z.string(),
  weight: z.number(),
  currentWeight: z.number(),
  detectedAt: z.string(),
  expiresAt: z.string().nullable(),
  decayModel: z.string(),
});

export const SignalAlertSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  signalType: z.string(),
  priority: z.string(),
  deadline: z.string(),
  status: z.string(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const ScoringConfigEntrySchema = z.object({
  category: z.string(),
  factor: z.string(),
  weight: z.number(),
  enabled: z.boolean(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const scoringContract = c.router(
  {
    getScore: {
      method: 'GET',
      path: '/contacts/:contactId/score',
      responses: {
        200: LeadScoreSchema,
        404: z.object({ error: z.string() }),
      },
      summary: 'Get lead score for a contact',
    },

    getScoreHistory: {
      method: 'GET',
      path: '/contacts/:contactId/score/history',
      query: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(ScoreHistoryEntrySchema),
      },
      summary: 'Get score history for a contact',
    },

    getSignals: {
      method: 'GET',
      path: '/contacts/:contactId/signals',
      query: z.object({
        activeOnly: z.coerce.boolean().optional(),
      }),
      responses: {
        200: z.array(IntentSignalSchema),
      },
      summary: 'Get intent signals for a contact',
    },

    recalculate: {
      method: 'POST',
      path: '/scoring/recalculate',
      body: z.object({
        contactId: z.string().uuid().optional(),
        batchSize: z.number().optional(),
      }),
      responses: {
        200: z.object({ message: z.string(), contactsProcessed: z.number() }),
      },
      summary: 'Recalculate scores',
    },

    getConfig: {
      method: 'GET',
      path: '/scoring/config',
      responses: {
        200: z.array(ScoringConfigEntrySchema),
      },
      summary: 'Get scoring configuration',
    },

    updateConfig: {
      method: 'PUT',
      path: '/scoring/config',
      body: z.object({
        configs: z.array(ScoringConfigEntrySchema),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
      summary: 'Update scoring configuration',
    },

    getLeaderboard: {
      method: 'GET',
      path: '/scoring/leaderboard',
      query: z.object({
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(LeadScoreSchema),
      },
      summary: 'Get score leaderboard',
    },

    listAlerts: {
      method: 'GET',
      path: '/signals/alerts',
      query: z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: {
        200: z.array(SignalAlertSchema),
      },
      summary: 'List signal alerts',
    },

    acknowledgeAlert: {
      method: 'POST',
      path: '/signals/alerts/:alertId/acknowledge',
      body: z.object({}),
      responses: {
        200: z.object({ message: z.string() }),
        404: z.object({ error: z.string() }),
      },
      summary: 'Acknowledge a signal alert',
    },
  },
  {
    pathPrefix: '/api/v1/scoring',
    strictStatusCodes: true,
  },
);
