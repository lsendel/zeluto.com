import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DrizzleCampaignRepository } from '../infrastructure/repositories/campaign-repository.js';
import {
  publishCampaignCompleted,
  publishCampaignStarted,
  publishDeliveryBatch,
} from './publisher.js';
import type {
  SegmentContactSource,
} from '../application/segment-contact-source.js';

const FAN_OUT_BATCH_SIZE = 500;

interface FanOutBatchPayload {
  organizationId: string;
  campaignId: string;
  cursor?: string;
}

export async function handleFanOutBatch(
  db: NeonHttpDatabase,
  queue: Queue,
  contactSource: SegmentContactSource,
  payload: FanOutBatchPayload,
): Promise<void> {
  const repo = new DrizzleCampaignRepository(db);
  const campaign = await repo.findById(payload.organizationId, payload.campaignId);

  if (!campaign) {
    console.warn(
      { campaignId: payload.campaignId, organizationId: payload.organizationId },
      'Fan-out skipped: campaign not found',
    );
    return;
  }

  if (!campaign.segmentId || !campaign.templateId) {
    console.error(
      { campaignId: campaign.id },
      'Fan-out skipped: missing templateId or segmentId',
    );
    return;
  }

  const page = await contactSource.fetchPage({
    organizationId: payload.organizationId,
    segmentId: campaign.segmentId,
    cursor: payload.cursor,
    limit: FAN_OUT_BATCH_SIZE,
  });

  if (!page.contacts.length) {
    if (!payload.cursor) {
      // No recipients at all - complete immediately
      campaign.updateStats({ recipientCount: 0 });
      campaign.markCompleted();
      await repo.save(campaign);
      await publishCampaignCompleted(queue, {
        organizationId: payload.organizationId,
        campaignId: payload.campaignId,
        sentCount: campaign.sentCount,
      });
    }
    return;
  }

  // Publish batched delivery jobs
  await publishDeliveryBatch(queue, {
    organizationId: payload.organizationId,
    campaignId: payload.campaignId,
    templateId: campaign.templateId,
    contacts: page.contacts,
  });

  const newRecipientCount = campaign.recipientCount + page.contacts.length;
  campaign.updateStats({ recipientCount: newRecipientCount });
  await repo.save(campaign);

  if (!payload.cursor) {
    await publishCampaignStarted(queue, {
      organizationId: payload.organizationId,
      campaignId: payload.campaignId,
      targetCount: page.total ?? newRecipientCount,
    });
  }

  if (page.nextCursor) {
    await queue.send({
      type: 'campaign.FanOutBatch',
      data: {
        organizationId: payload.organizationId,
        campaignId: payload.campaignId,
        cursor: page.nextCursor,
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: payload.campaignId,
        tenantContext: { organizationId: payload.organizationId },
      },
    });
    return;
  }

  campaign.markCompleted();
  await repo.save(campaign);
  await publishCampaignCompleted(queue, {
    organizationId: payload.organizationId,
    campaignId: payload.campaignId,
    sentCount: campaign.sentCount,
  });
}
