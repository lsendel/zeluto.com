// Middleware

// Hyperdrive / Database
export { createDatabase } from './hyperdrive/database.js';
export type { Logger } from './logger/index.js';
export { createLogger, createLoggerFromEnv } from './logger/index.js';
export type {
  ApiKeyData,
  ApiKeyMiddlewareConfig,
} from './middleware/api-key.js';
export {
  apiKeyMiddleware,
  generateApiKey,
  revokeApiKey,
  storeApiKey,
} from './middleware/api-key.js';
export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
} from './middleware/circuit-breaker.js';
export { CircuitBreaker } from './middleware/circuit-breaker.js';
export { corsMiddleware } from './middleware/cors.js';
export type { CspOptions } from './middleware/csp.js';
export { cspMiddleware } from './middleware/csp.js';
export { csrfMiddleware } from './middleware/csrf.js';
export { errorHandler } from './middleware/error-handler.js';
export type { LoggingOptions } from './middleware/logging.js';
export { loggingMiddleware } from './middleware/logging.js';
export { tenantMiddleware } from './middleware/tenant.js';
export type {
  DlqMessage,
  DlqMonitorConfig,
  DlqStats,
} from './monitoring/dlq-monitor.js';
// Monitoring
export {
  checkDlqDepth,
  getDlqStats,
  moveToDlq,
  replayDlqMessages,
  runDlqHealthCheck,
  sendDlqAlert,
} from './monitoring/dlq-monitor.js';
export type {
  QueueMetricEvent,
  QueueMetricStatus,
} from './monitoring/queue-telemetry.js';
export { logQueueMetric } from './monitoring/queue-telemetry.js';
// Outbox
export { drainOutbox, writeToOutbox } from './outbox/outbox.js';
// Saga
export type {
  SagaState,
  SagaStep,
  SagaStepState,
  SagaStepStatus,
} from './saga/saga-coordinator.js';
export { SagaCoordinator } from './saga/saga-coordinator.js';
export { createIdempotentConsumer } from './queue/consumer.js';
// Queue
export { publishBatch, publishEvent } from './queue/publisher.js';
// Tenant context cache (Durable Object helpers)
export {
  cacheTenantContext,
  cacheTenantState,
  deleteTenantState,
  fetchTenantContext,
  fetchTenantState,
  TenantContextDurableObject,
} from './tenant/tenant-context-do.js';
// Tracing
export { getCorrelationId, getTracingHeaders } from './tracing/context.js';
// Transaction
export { withTransaction } from './transaction/unit-of-work.js';
