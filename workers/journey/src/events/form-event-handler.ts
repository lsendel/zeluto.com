import type { FormSubmittedEvent } from '@mauntic/domain-kernel/events';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  createExecution,
  findActiveExecutionForContact,
} from '../infrastructure/repositories/execution-repository.js';
import { findJourneyById } from '../infrastructure/repositories/journey-repository.js';
import { findTriggersByType } from '../infrastructure/repositories/trigger-repository.js';
import { findLatestVersion } from '../infrastructure/repositories/version-repository.js';

/**
 * Handles FormSubmitted events by checking active journeys with event triggers
 * configured for form submissions.
 */
export async function handleFormSubmitted(
  db: NeonHttpDatabase,
  event: FormSubmittedEvent,
  eventsQueue: Queue,
): Promise<void> {
  const orgId = String(event.data.organizationId);
  const contactId = event.data.contactId ? String(event.data.contactId) : null;

  if (!contactId) return; // Cannot start journey without a contact

  // Find all event-type triggers for this org
  const triggers = await findTriggersByType(db, orgId, 'event');

  for (const trigger of triggers) {
    const config = trigger.config as Record<string, unknown>;

    // Check if this trigger is for form submissions
    if (config.eventType !== 'form_submitted') continue;

    // Optionally check if it's for a specific form
    if (config.formId && config.formId !== event.data.formId) continue;

    // Check if journey is active
    const journey = await findJourneyById(db, orgId, trigger.journey_id);
    if (!journey || journey.status !== 'active') continue;

    // Check if contact already has an active execution
    const existing = await findActiveExecutionForContact(
      db,
      orgId,
      journey.id,
      contactId,
    );
    if (existing) continue;

    // Get latest published version
    const latestVersion = await findLatestVersion(db, orgId, journey.id);
    if (!latestVersion) continue;

    // Create execution
    const execution = await createExecution(db, orgId, {
      journey_id: journey.id,
      journey_version_id: latestVersion.id,
      contact_id: contactId,
      status: 'active',
    });

    // Enqueue execution start
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
      console.error('Failed to enqueue execution start for form trigger:', err);
    }
  }
}
