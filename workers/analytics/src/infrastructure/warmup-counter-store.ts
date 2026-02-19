import type { WarmupCounterStore } from '@mauntic/analytics-domain';

export class KvWarmupCounterStore implements WarmupCounterStore {
  constructor(private readonly kv: KVNamespace) {}

  async resetDailyCounter(organizationId: string, domain: string): Promise<void> {
    const key = `warmup:daily:${organizationId}:${domain}`;
    await this.kv.delete(key);
  }
}
