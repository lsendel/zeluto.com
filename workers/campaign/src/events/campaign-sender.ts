import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DrizzleCampaignRepository } from '../infrastructure/repositories/campaign-repository.js';

/**
 * Handles the campaign send flow:
 * 1. Loads the campaign from DB
 * 2. Fetches segment contacts (stubbed - will call CRM service)
 * 3. Creates delivery jobs in batches via the EVENTS queue
 * 4. Updates campaign stats
 *
 * This is triggered when a CampaignSent event is consumed from the queue.
 */
export async function handleCampaignSend(
  db: NeonHttpDatabase,
  queue: Queue,
  event: {
    organizationId: string;
    campaignId: string;
  },
): Promise<void> {
  const { organizationId, campaignId } = event;
  const repo = new DrizzleCampaignRepository(db);

  // Load campaign
  const campaign = await repo.findById(organizationId, campaignId);
  if (!campaign) {
    console.error(`Campaign ${campaignId} not found for org ${organizationId}`);
    return;
  }

  if (campaign.status !== 'sending') {
    console.warn(`Campaign ${campaignId} is not in sending status, skipping`);
    return;
  }

  if (!campaign.templateId || !campaign.segmentId) {
    console.error(`Campaign ${campaignId} missing templateId or segmentId`);
    return;
  }

  // Enqueue first fan-out batch. Subsequent batches will enqueue themselves.
  await queue.send({
    type: 'campaign.FanOutBatch',
    data: {
      organizationId,
      campaignId,
    },
    metadata: {
      id: crypto.randomUUID(),
      version: 1,
      sourceContext: 'campaign',
      timestamp: new Date().toISOString(),
      correlationId: campaignId,
      tenantContext: { organizationId },
    },
  });
}
