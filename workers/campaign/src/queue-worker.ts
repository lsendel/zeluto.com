import type { CampaignQueueEnv } from './events/index.js';
import { handleCampaignQueue } from './events/index.js';

export async function queue(batch: MessageBatch, env: CampaignQueueEnv): Promise<void> {
  await handleCampaignQueue(batch, env);
}
