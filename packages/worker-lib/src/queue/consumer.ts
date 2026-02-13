import type { TenantContext } from '@mauntic/domain-kernel/tenant';

export function createIdempotentConsumer<T>(
  handler: (message: T, ctx: TenantContext) => Promise<void>,
  kv: KVNamespace,
) {
  return async (batch: MessageBatch<T>) => {
    for (const msg of batch.messages) {
      const idempotencyKey = `idem:${msg.id}`;
      const existing = await kv.get(idempotencyKey);

      if (existing) {
        msg.ack();
        continue;
      }

      try {
        const data = msg.body as any;
        await handler(
          data,
          data.metadata?.tenantContext ?? data.tenantContext,
        );
        await kv.put(idempotencyKey, '1', { expirationTtl: 86400 });
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  };
}
