import type {
  CampaignEventPayload,
  CampaignEventPublisher,
} from '@mauntic/campaign-domain';
export class QueueCampaignEventPublisher implements CampaignEventPublisher {
  constructor(
    private readonly queue: Queue,
    private readonly maxRetries = 3,
  ) {}

  async publish(event: CampaignEventPayload): Promise<void> {
    const payload = {
      type: event.type,
      data: event.data,
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'campaign',
        timestamp: new Date().toISOString(),
        correlationId: event.data.campaignId,
        tenantContext: { organizationId: event.data.organizationId },
      },
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.queue.send(payload);
        console.info(
          { event: event.type, campaignId: event.data.campaignId },
          'Campaign event published',
        );
        return;
      } catch (error) {
        if (attempt === this.maxRetries) {
          console.error(
            { event: event.type, campaignId: event.data.campaignId, error },
            'Failed to publish campaign event',
          );
          throw error;
        }

        await sleep(50 * attempt);
      }
    }
  }
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
