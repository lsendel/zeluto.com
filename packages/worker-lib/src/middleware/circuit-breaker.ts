import { DomainError } from '@mauntic/domain-kernel/errors';

export class CircuitBreaker {
  constructor(
    private kv: KVNamespace,
    private service: string,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.kv.get(`cb:${this.service}`);

    if (state === 'open') {
      const openedAt = await this.kv.get(`cb:${this.service}:opened`);
      if (openedAt && Date.now() - Number(openedAt) < 30_000) {
        throw new DomainError(
          'SERVICE_UNAVAILABLE',
          `${this.service} is temporarily unavailable`,
          503,
        );
      }
    }

    try {
      const result = await fn();
      await this.kv.delete(`cb:${this.service}`);
      return result;
    } catch (err) {
      await this.recordFailure();
      throw err;
    }
  }

  private async recordFailure() {
    const key = `cb:${this.service}:failures`;
    const count = Number((await this.kv.get(key)) ?? 0) + 1;
    await this.kv.put(key, String(count), { expirationTtl: 60 });

    if (count >= 5) {
      await this.kv.put(`cb:${this.service}`, 'open', { expirationTtl: 60 });
      await this.kv.put(`cb:${this.service}:opened`, String(Date.now()), {
        expirationTtl: 60,
      });
    }
  }
}
