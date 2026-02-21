import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  createExecution,
  findActiveExecutionForContact,
} from '../infrastructure/repositories/execution-repository.js';
import { findJourneyById } from '../infrastructure/repositories/journey-repository.js';
import { findTriggersByType } from '../infrastructure/repositories/trigger-repository.js';
import { findLatestVersion } from '../infrastructure/repositories/version-repository.js';

export interface ContactSegmentChangedEvent {
  type: 'crm.ContactSegmentChanged';
  data: {
    organizationId: string;
    contactId: string;
    segmentId: string;
    action: 'entered' | 'exited';
  };
}

/**
 * Handles ContactSegmentChanged events by finding segment-type journey triggers
 * whose segmentId matches and starting executions for contacts entering the segment.
 */
export async function handleSegmentChanged(
  db: NeonHttpDatabase,
  event: ContactSegmentChangedEvent,
  eventsQueue: Queue,
): Promise<void> {
  // Only trigger journeys when contacts enter a segment, not when they leave
  if (event.data.action !== 'entered') return;

  const orgId = String(event.data.organizationId);
  const contactId = String(event.data.contactId);
  const segmentId = event.data.segmentId;

  const triggers = await findTriggersByType(db, orgId, 'segment');

  for (const trigger of triggers) {
    const config = trigger.config as Record<string, unknown>;
    if (config.segmentId !== segmentId) continue;

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
        'Failed to enqueue execution start for segment trigger:',
        err,
      );
    }
  }
}