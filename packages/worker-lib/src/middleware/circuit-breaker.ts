import { DomainError } from '@mauntic/domain-kernel/errors';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  lastStateChange: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Window in ms for counting failures (default: 60000) */
  failureWindowMs?: number;
  /** How long the circuit stays open before allowing a probe (default: 30000) */
  openDurationMs?: number;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  failureWindowMs: 60_000,
  openDurationMs: 30_000,
};

/**
 * Circuit breaker for Fly.io service calls from CF Workers.
 *
 * State machine:
 *   closed  -> (failureThreshold failures in failureWindowMs) -> open
 *   open    -> (after openDurationMs)                         -> half-open
 *   half-open -> (1 successful probe)                         -> closed
 *   half-open -> (1 failed probe)                             -> open
 *
 * State is persisted in KV so it survives across Worker invocations.
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;

  constructor(
    private kv: KVNamespace,
    private service: string,
    config?: CircuitBreakerConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private get stateKey(): string {
    return `cb:${this.service}:state`;
  }

  async getState(): Promise<CircuitBreakerState> {
    const raw = await this.kv.get(this.stateKey);
    if (!raw) {
      return {
        state: 'closed',
        failures: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
      };
    }
    return JSON.parse(raw) as CircuitBreakerState;
  }

  private async setState(state: CircuitBreakerState): Promise<void> {
    // TTL = failure window + open duration + buffer, so stale entries clean up
    const ttl = Math.ceil(
      (this.config.failureWindowMs + this.config.openDurationMs + 60_000) / 1000,
    );
    await this.kv.put(this.stateKey, JSON.stringify(state), {
      expirationTtl: ttl,
    });
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * - If circuit is open and cooldown has not elapsed, throws immediately.
   * - If circuit is half-open, allows exactly one probe call.
   * - On success in half-open, resets to closed.
   * - On failure in half-open, reopens the circuit.
   * - In closed state, tracks failures and opens if threshold is exceeded.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const current = await this.getState();
    const now = Date.now();

    // OPEN state: check if cooldown elapsed
    if (current.state === 'open') {
      const elapsed = now - current.lastStateChange;
      if (elapsed < this.config.openDurationMs) {
        throw new DomainError(
          'SERVICE_UNAVAILABLE',
          `${this.service} is temporarily unavailable (circuit open, retry in ${Math.ceil((this.config.openDurationMs - elapsed) / 1000)}s)`,
          503,
        );
      }

      // Cooldown elapsed: transition to half-open, allow one probe
      await this.setState({
        state: 'half-open',
        failures: current.failures,
        lastFailureTime: current.lastFailureTime,
        lastStateChange: now,
      });
    }

    // Determine current effective state after possible transition
    const effectiveState = current.state === 'open' ? 'half-open' : current.state;

    try {
      const result = await fn();

      // Success: reset to closed
      if (effectiveState === 'half-open' || current.failures > 0) {
        await this.setState({
          state: 'closed',
          failures: 0,
          lastFailureTime: 0,
          lastStateChange: now,
        });
      }

      return result;
    } catch (err) {
      if (effectiveState === 'half-open') {
        // Probe failed: reopen circuit
        await this.setState({
          state: 'open',
          failures: current.failures + 1,
          lastFailureTime: now,
          lastStateChange: now,
        });
      } else {
        // Closed state: record failure
        await this.recordFailure(current, now);
      }
      throw err;
    }
  }

  private async recordFailure(
    current: CircuitBreakerState,
    now: number,
  ): Promise<void> {
    // If the last failure was outside the failure window, reset counter
    const windowStart = now - this.config.failureWindowMs;
    const failuresInWindow =
      current.lastFailureTime >= windowStart ? current.failures + 1 : 1;

    if (failuresInWindow >= this.config.failureThreshold) {
      // Threshold exceeded: open the circuit
      await this.setState({
        state: 'open',
        failures: failuresInWindow,
        lastFailureTime: now,
        lastStateChange: now,
      });
    } else {
      // Still under threshold: update failure count
      await this.setState({
        state: 'closed',
        failures: failuresInWindow,
        lastFailureTime: now,
        lastStateChange: current.lastStateChange,
      });
    }
  }
}
