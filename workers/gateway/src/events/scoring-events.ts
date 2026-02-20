/**
 * Cross-context event routing for Scoring & Intent events.
 *
 * Event flows:
 * LeadScoredEvent → evaluates journey triggers, updates CRM contact fields
 * IntentSignalDetectedEvent → evaluates journey triggers, creates signal alerts
 * ScoreThresholdCrossedEvent → routes to RevOps for lead routing
 */

export interface LeadScoredPayload {
  organizationId: string;
  contactId: string;
  score: number;
  grade: string;
  previousScore: number | null;
}

export function routeLeadScoredEvent(payload: LeadScoredPayload) {
  return [
    {
      targetQueue: 'journey:score-trigger-eval',
      data: {
        organizationId: payload.organizationId,
        contactId: payload.contactId,
        score: payload.score,
        grade: payload.grade,
        previousScore: payload.previousScore,
        eventType: 'LeadScored',
      },
    },
    {
      targetQueue: 'crm:update-contact-score',
      data: {
        organizationId: payload.organizationId,
        contactId: payload.contactId,
        score: payload.score,
        grade: payload.grade,
      },
    },
  ];
}

export interface IntentSignalPayload {
  organizationId: string;
  contactId: string;
  signalType: string;
  weight: number;
  source: string;
}

export function routeIntentSignalDetectedEvent(payload: IntentSignalPayload) {
  return [
    {
      targetQueue: 'journey:score-trigger-eval',
      data: {
        organizationId: payload.organizationId,
        contactId: payload.contactId,
        score: 0,
        grade: '',
        eventType: 'IntentSignalDetected',
        signalType: payload.signalType,
      },
    },
  ];
}

export interface ScoreThresholdCrossedPayload {
  organizationId: string;
  contactId: string;
  threshold: number;
  direction: 'up' | 'down';
  score: number;
}

export function routeScoreThresholdCrossedEvent(
  payload: ScoreThresholdCrossedPayload,
) {
  return [
    {
      targetQueue: 'revops:routing',
      data: {
        organizationId: payload.organizationId,
        contactId: payload.contactId,
        reason: `score_threshold_${payload.direction}`,
        threshold: payload.threshold,
        score: payload.score,
      },
    },
  ];
}
