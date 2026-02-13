import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  findCampaignById,
  updateCampaign,
} from '../infrastructure/repositories/campaign-repository.js';
import { publishDeliveryBatch, publishCampaignStarted } from './publisher.js';

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

  // Load campaign
  const campaign = await findCampaignById(db, organizationId, campaignId);
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

  // Fetch segment contacts
  // In production this would call the CRM service to get contacts in the segment.
  // For now we use a stub that returns an empty array - the actual integration
  // happens via cross-service calls or shared database access.
  const contacts = await fetchSegmentContacts(organizationId, campaign.segmentId);

  if (contacts.length === 0) {
    console.warn(`No contacts found in segment ${campaign.segmentId} for campaign ${campaignId}`);
    // Mark campaign completed with 0 sends
    await updateCampaign(db, organizationId, campaignId, {
      status: 'sent',
      completedAt: new Date(),
      recipientCount: 0,
    });
    return;
  }

  // Update recipient count on campaign
  await updateCampaign(db, organizationId, campaignId, {
    recipientCount: contacts.length,
  });

  // Publish CampaignStarted event
  await publishCampaignStarted(queue, {
    organizationId,
    campaignId,
    targetCount: contacts.length,
  });

  // Create delivery jobs for each batch of contacts
  const batchSize = 500;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    await publishDeliveryBatch(queue, {
      organizationId,
      campaignId,
      templateId: campaign.templateId,
      contacts: batch,
    });
  }
}

/**
 * Stub for fetching contacts from a segment.
 * In production, this would call the CRM service or use a shared database view.
 */
async function fetchSegmentContacts(
  _organizationId: string,
  _segmentId: string,
): Promise<Array<{ contactId: string }>> {
  // TODO: Integrate with CRM service to fetch segment contacts
  // This would typically be an HTTP call to the CRM worker or
  // a direct database query against the CRM schema.
  return [];
}
