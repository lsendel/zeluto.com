import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type {
  MessageDeliveredEvent,
  MessageOpenedEvent,
  MessageClickedEvent,
  MessageBouncedEvent,
} from '@mauntic/domain-kernel/events';
import {
  findExecutionById,
  updateExecution,
  findStepExecutionsByExecutionId,
  updateStepExecution,
  createExecutionLog,
} from '../infrastructure/repositories/execution-repository.js';

type DeliveryEvent =
  | MessageDeliveredEvent
  | MessageOpenedEvent
  | MessageClickedEvent
  | MessageBouncedEvent;

/**
 * Handles delivery events (delivered, opened, clicked, bounced) to update
 * gate step conditions in active journey executions.
 *
 * When a journey step is a "gate" waiting for a delivery event (e.g., wait for
 * email_opened), this handler checks if the delivery event matches a pending
 * gate condition and advances the execution.
 */
export async function handleDeliveryEvent(
  db: NeonHttpDatabase,
  event: DeliveryEvent,
  eventsQueue: Queue,
): Promise<void> {
  const orgId = String(event.data.organizationId);
  const deliveryJobId = event.data.deliveryJobId;

  // Look for executions that have a metadata reference to this delivery job
  // The journey execution context is stored in the delivery metadata
  const eventData = event.data as Record<string, unknown>;
  const journeyExecutionId = eventData.journeyExecutionId as string | undefined;

  if (!journeyExecutionId) return; // Not related to a journey execution

  const execution = await findExecutionById(db, orgId, journeyExecutionId);
  if (!execution || execution.status !== 'active') return;

  // Log the delivery event against this execution
  await createExecutionLog(db, orgId, {
    execution_id: execution.id,
    level: 'info',
    message: `Delivery event received: ${event.type}`,
    metadata: {
      deliveryJobId,
      eventType: event.type,
    },
  });

  // Check if the current step is a gate waiting for this event type
  if (!execution.current_step_id) return;

  const stepExecutions = await findStepExecutionsByExecutionId(db, orgId, execution.id);
  const currentStepExec = stepExecutions.find(
    (se) => se.step_id === execution.current_step_id && se.status === 'pending',
  );

  if (!currentStepExec) return;

  // Map delivery event types to gate condition types
  const eventToGate: Record<string, string> = {
    'delivery.MessageDelivered': 'email_delivered',
    'delivery.MessageOpened': 'email_opened',
    'delivery.MessageClicked': 'email_clicked',
    'delivery.MessageBounced': 'email_bounced',
  };

  const gateCondition = eventToGate[event.type];
  if (!gateCondition) return;

  // Mark the gate step as completed and advance
  await updateStepExecution(db, orgId, currentStepExec.id, {
    status: 'completed',
    completed_at: new Date(),
    result: { triggeredBy: event.type, deliveryJobId },
  });

  // Enqueue next step execution
  try {
    await eventsQueue.send({
      type: 'journey.ExecuteNextStep',
      data: {
        organizationId: orgId,
        executionId: execution.id,
        stepId: execution.current_step_id,
        gateResult: gateCondition,
      },
      metadata: {
        organizationId: orgId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Failed to enqueue next step after gate:', err);
  }
}
