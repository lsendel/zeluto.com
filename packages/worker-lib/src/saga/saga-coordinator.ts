/**
 * Lightweight saga coordinator for multi-step cross-worker flows.
 *
 * State is persisted in Cloudflare KV so it survives across worker
 * invocations. Each saga step is idempotent — re-executing a completed
 * step is a no-op. If a step fails, previously completed steps are
 * compensated in reverse order.
 *
 * Usage:
 * ```ts
 * const saga = new SagaCoordinator(env.KV, 'onboarding', orgId);
 *
 * saga.step('create-org', {
 *   execute: async () => { ... return orgId; },
 *   compensate: async (result) => { await deleteOrg(result); },
 * });
 *
 * saga.step('provision-billing', {
 *   execute: async () => { ... },
 *   compensate: async () => { ... },
 * });
 *
 * const result = await saga.run();
 * ```
 */

export interface SagaStep<T = unknown> {
  execute: () => Promise<T>;
  compensate?: (result: T) => Promise<void>;
}

export type SagaStepStatus = 'pending' | 'completed' | 'failed' | 'compensated';

export interface SagaStepState {
  name: string;
  status: SagaStepStatus;
  result?: unknown;
  error?: string;
  completedAt?: string;
}

export interface SagaState {
  sagaId: string;
  sagaType: string;
  status: 'running' | 'completed' | 'compensating' | 'compensated' | 'failed';
  steps: SagaStepState[];
  startedAt: string;
  completedAt?: string;
}

export class SagaCoordinator {
  private steps: Array<{ name: string; step: SagaStep }> = [];
  private readonly kvKey: string;

  constructor(
    private readonly kv: KVNamespace,
    private readonly sagaType: string,
    private readonly sagaId: string,
    /** TTL for saga state in KV (default 7 days) */
    private readonly ttlSeconds = 7 * 24 * 60 * 60,
  ) {
    this.kvKey = `saga:${sagaType}:${sagaId}`;
  }

  /**
   * Register a step in the saga. Steps execute in registration order.
   */
  step<T>(name: string, step: SagaStep<T>): this {
    this.steps.push({ name, step: step as SagaStep });
    return this;
  }

  /**
   * Execute all steps. If any step fails, compensate completed steps
   * in reverse order.
   */
  async run(): Promise<SagaState> {
    let state = await this.loadState();

    if (!state) {
      state = {
        sagaId: this.sagaId,
        sagaType: this.sagaType,
        status: 'running',
        steps: this.steps.map(({ name }) => ({
          name,
          status: 'pending' as SagaStepStatus,
        })),
        startedAt: new Date().toISOString(),
      };
    }

    // Execute steps in order
    for (let i = 0; i < this.steps.length; i++) {
      const { name, step } = this.steps[i];
      const stepState = state.steps[i];

      // Skip already completed steps (idempotent)
      if (stepState.status === 'completed') continue;

      try {
        const result = await step.execute();
        stepState.status = 'completed';
        stepState.result = result;
        stepState.completedAt = new Date().toISOString();
        await this.saveState(state);
      } catch (err) {
        stepState.status = 'failed';
        stepState.error = err instanceof Error ? err.message : String(err);
        state.status = 'compensating';
        await this.saveState(state);

        // Compensate completed steps in reverse order
        await this.compensate(state, i - 1);
        return state;
      }
    }

    state.status = 'completed';
    state.completedAt = new Date().toISOString();
    await this.saveState(state);
    return state;
  }

  private async compensate(state: SagaState, fromIndex: number): Promise<void> {
    for (let i = fromIndex; i >= 0; i--) {
      const { step } = this.steps[i];
      const stepState = state.steps[i];

      if (stepState.status !== 'completed' || !step.compensate) continue;

      try {
        await step.compensate(stepState.result);
        stepState.status = 'compensated';
      } catch (err) {
        // Compensation failure — log and continue compensating other steps
        console.error(
          `Saga ${this.sagaType}:${this.sagaId} compensation failed for step "${stepState.name}":`,
          err,
        );
        stepState.error = `compensation failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const hasFailedCompensation = state.steps.some(
      (s) => s.status === 'completed' && s.error?.startsWith('compensation'),
    );
    state.status = hasFailedCompensation ? 'failed' : 'compensated';
    await this.saveState(state);
  }

  private async loadState(): Promise<SagaState | null> {
    const raw = await this.kv.get(this.kvKey);
    return raw ? (JSON.parse(raw) as SagaState) : null;
  }

  private async saveState(state: SagaState): Promise<void> {
    await this.kv.put(this.kvKey, JSON.stringify(state), {
      expirationTtl: this.ttlSeconds,
    });
  }

  /**
   * Load the current saga state (for monitoring/debugging).
   */
  async getState(): Promise<SagaState | null> {
    return this.loadState();
  }
}
