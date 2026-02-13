// Middleware
export { errorHandler } from './middleware/error-handler.js';
export { loggingMiddleware } from './middleware/logging.js';
export type { Logger } from './middleware/logging.js';
export { tenantMiddleware } from './middleware/tenant.js';
export { csrfMiddleware } from './middleware/csrf.js';
export { CircuitBreaker } from './middleware/circuit-breaker.js';
export type { CircuitBreakerConfig, CircuitBreakerState, CircuitState } from './middleware/circuit-breaker.js';
export { corsMiddleware } from './middleware/cors.js';
export { cspMiddleware } from './middleware/csp.js';
export type { CspOptions } from './middleware/csp.js';
export { apiKeyMiddleware, storeApiKey, revokeApiKey, generateApiKey } from './middleware/api-key.js';
export type { ApiKeyData, ApiKeyMiddlewareConfig } from './middleware/api-key.js';

// Hyperdrive / Database
export { createDatabase } from './hyperdrive/database.js';

// Queue
export { publishEvent, publishBatch } from './queue/publisher.js';
export { createIdempotentConsumer } from './queue/consumer.js';

// Transaction
export { withTransaction } from './transaction/unit-of-work.js';

// Tracing
export { getTracingHeaders, getCorrelationId } from './tracing/context.js';

// Monitoring
export {
  checkDlqDepth,
  getDlqStats,
  replayDlqMessages,
  moveToDlq,
  sendDlqAlert,
  runDlqHealthCheck,
} from './monitoring/dlq-monitor.js';
export type { DlqMonitorConfig, DlqMessage, DlqStats } from './monitoring/dlq-monitor.js';
