import type { WarmupCounterStore } from '@mauntic/analytics-domain';
import type Redis from 'ioredis';

export class RedisWarmupCounterStore implements WarmupCounterStore {
  constructor(private readonly redis: Redis) {}

  async resetDailyCounter(organizationId: string, domain: string): Promise<void> {
    const key = `warmup:daily:${organizationId}:${domain}`;
    await this.redis.del(key);
  }
}
