import {
  asCampaignId,
  asContactId,
  asOrganizationId,
  asTemplateId,
} from '@mauntic/domain-kernel';
import type {
  CampaignCompletedEvent,
  CampaignStartedEvent,
  PointsAwardedEvent,
  SendMessageEvent,
} from '@mauntic/domain-kernel/events';

/**
 * Publishes a SendMessage event for each contact in a campaign batch.
 * This bridges the campaign context to the delivery context.
 */
export async function publishDeliveryBatch(
  queue: Queue,
  params: {
    organizationId: string;
    campaignId: string;
    templateId: string;
    contacts: Array<{ contactId: string }>;
  },
): Promise<void> {
  const messages = params.contacts.map((contact) => {
    const event: SendMessageEvent = {
      type: 'delivery.SendMessage',
      data: {
        organizationId: asOrganizationId(params.organizationId),
        channel: 'email',
        contactId: asContactId(contact.contactId),
        templateId: asTemplateId(params.templateId),
        campaignId: asCampaignId(params.campaignId),
        idempotencyKey: `campaign:${params.campaignId}:${contact.contactId}`,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: params.campaignId,
        tenantContext: {
          organizationId: asOrganizationId(params.organizationId),
        },
      },
    };
    return { body: event };
  });

  // Send in batches of 100 (CF Queue limit)
  const batchSize = 100;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await queue.sendBatch(batch as any);
  }
}

/**
 * Publishes a PointsAwarded event when points are awarded to a contact.
 */
export async function publishPointsAwarded(
  queue: Queue,
  params: {
    organizationId: string;
    contactId: string;
    points: number;
    reason: string;
  },
): Promise<void> {
  const event: PointsAwardedEvent = {
    type: 'misc.PointsAwarded',
    data: {
      organizationId: asOrganizationId(params.organizationId),
      contactId: asContactId(params.contactId),
      points: params.points,
      reason: params.reason,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'campaign',
      timestamp: new Date().toISOString(),
      correlationId: params.contactId,
      tenantContext: {
        organizationId: asOrganizationId(params.organizationId),
      },
    },
  };

  await queue.send(event);
}

/**
 * Publishes a CampaignStarted event when a campaign begins sending.
 */
export async function publishCampaignStarted(
  queue: Queue,
  params: {
    organizationId: string;
    campaignId: string;
    targetCount: number;
  },
): Promise<void> {
  const event: CampaignStartedEvent = {
    type: 'campaign.CampaignStarted',
    data: {
      organizationId: asOrganizationId(params.organizationId),
      campaignId: asCampaignId(params.campaignId),
      startedAt: new Date().toISOString(),
      targetCount: params.targetCount,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'campaign',
      timestamp: new Date().toISOString(),
      correlationId: params.campaignId,
      tenantContext: {
        organizationId: asOrganizationId(params.organizationId),
      },
    },
  };

  await queue.send(event);
}

/**
 * Publishes a CampaignCompleted event when a campaign finishes sending.
 */
export async function publishCampaignCompleted(
  queue: Queue,
  params: {
    organizationId: string;
    campaignId: string;
    sentCount: number;
  },
): Promise<void> {
  const event: CampaignCompletedEvent = {
    type: 'campaign.CampaignCompleted',
    data: {
      organizationId: asOrganizationId(params.organizationId),
      campaignId: asCampaignId(params.campaignId),
      completedAt: new Date().toISOString(),
      sentCount: params.sentCount,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'campaign',
      timestamp: new Date().toISOString(),
      correlationId: params.campaignId,
      tenantContext: {
        organizationId: asOrganizationId(params.organizationId),
      },
    },
  };

  await queue.send(event);
}
