import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  createExecution,
  findActiveExecutionForContact,
} from '../infrastructure/repositories/execution-repository.js';
import { findJourneyById } from '../infrastructure/repositories/journey-repository.js';
import { findTriggersByType } from '../infrastructure/repositories/trigger-repository.js';
import { findLatestVersion } from '../infrastructure/repositories/version-repository.js';

export interface ScoreChangedEvent {
  type: 'scoring.ScoreChanged';
  data: {
    organizationId: string;
    contactId: string;
    score: number;
    previousScore: number;
  };
}

export interface IntentDetectedEvent {
  type: 'scoring.IntentDetected';
  data: {
    organizationId: string;
    contactId: string;
    intentType: string;
    strength: number;
  };
}

/**
 * Handles ScoreChanged events by finding score-type journey triggers
 * and starting executions when threshold conditions are met.
 */
export async function handleScoreChanged(
  db: NeonHttpDatabase,
  event: ScoreChangedEvent,
  eventsQueue: Queue,
): Promise<void> {
  const orgId = String(event.data.organizationId);
  const contactId = String(event.data.contactId);
  const score = event.data.score;

  const triggers = await findTriggersByType(db, orgId, 'score');

  for (const trigger of triggers) {
    const config = trigger.config as Record<string, unknown>;
    const threshold = Number(config.threshold);
    const operator = config.operator as string;

    // Evaluate threshold condition
    const matches =
      (operator === 'gte' && score >= threshold) ||
      (operator === 'lte' && score <= threshold) ||
      (operator === 'eq' && score === threshold);

    if (!matches) continue;

    const journey = await findJourneyById(db, orgId, trigger.journey_id);
    if (!journey || journey.status !== 'active') continue;

    const existing = await findActiveExecutionForContact(
      db,
      orgId,
      journey.id,
      contactId,
    );
    if (existing) continue;

    const latestVersion = await findLatestVersion(db, orgId, journey.id);
    if (!latestVersion) continue;

    const execution = await createExecution(db, orgId, {
      journey_id: journey.id,
      journey_version_id: latestVersion.id,
      contact_id: contactId,
      status: 'active',
    });

    try {
      await eventsQueue.send({
        type: 'journey.ExecutionStarted',
        data: {
          organizationId: orgId,
          journeyId: journey.id,
          executionId: execution.id,
          contactId,
          versionId: latestVersion.id,
        },
        metadata: {
          organizationId: orgId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(
        'Failed to enqueue execution start for score trigger:',
        err,
      );
    }
  }
}

/**
 * Handles IntentDetected events by finding intent-type journey triggers
 * and starting executions when intent type and strength match.
 */
export async function handleIntentDetected(
  db: NeonHttpDatabase,
  event: IntentDetectedEvent,
  eventsQueue: Queue,
): Promise<void> {
  const orgId = String(event.data.organizationId);
  const contactId = String(event.data.contactId);
  const intentType = event.data.intentType;
  const strength = event.data.strength;

  const triggers = await findTriggersByType(db, orgId, 'intent');

  for (const trigger of triggers) {
    const config = trigger.config as Record<string, unknown>;

    if (config.intentType !== intentType) continue;
    const minStrength = config.minStrength as number | undefined;
    if (minStrength !== undefined && strength < minStrength) continue;

    const journey = await findJourneyById(db, orgId, trigger.journey_id);
    if (!journey || journey.status !== 'active') continue;

    const existing = await findActiveExecutionForContact(
      db,
      orgId,
      journey.id,
      contactId,
    );
    if (existing) continue;

    const latestVersion = await findLatestVersion(db, orgId, journey.id);
    if (!latestVersion) continue;

    const execution = await createExecution(db, orgId, {
      journey_id: journey.id,
      journey_version_id: latestVersion.id,
      contact_id: contactId,
      status: 'active',
    });

    try {
      await eventsQueue.send({
        type: 'journey.ExecutionStarted',
        data: {
          organizationId: orgId,
          journeyId: journey.id,
          executionId: execution.id,
          contactId,
          versionId: latestVersion.id,
        },
        metadata: {
          organizationId: orgId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error(
        'Failed to enqueue execution start for intent trigger:',
        err,
      );
    }
  }
}