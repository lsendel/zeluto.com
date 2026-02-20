import {
  asContactId,
  asOrganizationId,
  asTemplateId,
} from '@mauntic/domain-kernel';
import type { SendMessageEvent } from '@mauntic/domain-kernel/events';

export interface SendEmailFromJourneyParams {
  organizationId: string;
  contactId: string;
  templateId: number;
  journeyId: string;
  executionId: string;
  stepId: string;
}

/**
 * Publishes a SendMessage event to the delivery queue when a journey
 * action step is "send_email". Includes journey execution context in
 * the event so delivery events can be correlated back to the journey.
 */
export async function publishSendEmailEvent(
  queue: Queue,
  params: SendEmailFromJourneyParams,
): Promise<void> {
  const idempotencyKey = `journey:${params.executionId}:${params.stepId}`;

  const event: SendMessageEvent = {
    type: 'delivery.SendMessage',
    data: {
      organizationId: asOrganizationId(params.organizationId),
      channel: 'email',
      contactId: asContactId(params.contactId),
      templateId: asTemplateId(String(params.templateId)),
      journeyExecutionId: params.executionId,
      idempotencyKey,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'journey',
      timestamp: new Date().toISOString(),
      correlationId: params.executionId,
      causationId: params.stepId,
      tenantContext: {
        organizationId: asOrganizationId(params.organizationId),
      },
    },
  };

  await queue.send(event);
}

export interface SendSmsFromJourneyParams {
  organizationId: string;
  contactId: string;
  templateId: number;
  journeyId: string;
  executionId: string;
  stepId: string;
}

/**
 * Publishes a SendMessage event for SMS channel from a journey action step.
 */
export async function publishSendSmsEvent(
  queue: Queue,
  params: SendSmsFromJourneyParams,
): Promise<void> {
  const idempotencyKey = `journey:${params.executionId}:${params.stepId}`;

  const event: SendMessageEvent = {
    type: 'delivery.SendMessage',
    data: {
      organizationId: asOrganizationId(params.organizationId),
      channel: 'sms',
      contactId: asContactId(params.contactId),
      templateId: asTemplateId(String(params.templateId)),
      journeyExecutionId: params.executionId,
      idempotencyKey,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'journey',
      timestamp: new Date().toISOString(),
      correlationId: params.executionId,
      causationId: params.stepId,
      tenantContext: {
        organizationId: asOrganizationId(params.organizationId),
      },
    },
  };

  await queue.send(event);
}
