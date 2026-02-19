export default {
  async queue(batch: MessageBatch, _env: unknown, _ctx: ExecutionContext) {
    for (const message of batch.messages) {
      console.warn('Lead Intelligence queue handler not implemented, acknowledging message', {
        id: message.id,
      });
      message.ack();
    }
  },
};
