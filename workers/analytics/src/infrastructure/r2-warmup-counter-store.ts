import type { R2Bucket } from '@cloudflare/workers-types';
import type { WarmupCounterStore } from '@mauntic/analytics-domain';

export class R2WarmupCounterStore implements WarmupCounterStore {
  constructor(private readonly bucket: R2Bucket) {}

  async resetDailyCounter(
    organizationId: string,
    domain: string,
  ): Promise<void> {
    const key = `warmup/daily/${organizationId}/${domain}`;
    await this.bucket.delete(key).catch(() => Promise.resolve());
  }
}
