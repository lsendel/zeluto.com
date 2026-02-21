import { describe, expect, it, vi } from 'vitest';
import { handleScoringQueue, type ScoringQueueEnv } from './queue-handler.js';

vi.mock('@mauntic/worker-lib', () => ({
  createDatabase: vi.fn(() => ({})),
  createLoggerFromEnv: vi.fn(() => ({
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  })),
  logQueueMetric: vi.fn(),
}));

vi.mock('../infrastructure/drizzle-lead-score-repository.js', () => ({
  DrizzleLeadScoreRepository: class {
    constructor() {}
  },
}));

vi.mock('../infrastructure/drizzle-scoring-repositories.js', () => ({
  DrizzleIntentSignalRepository: class {
    constructor() {}
  },
  DrizzleSignalAlertRepository: class {
    constructor() {}
  },
}));

vi.mock('../application/scoring-service.js', () => ({
  ScoringService: class {
    calculateScore = vi.fn().mockRejectedValue(new Error('db down'));
  },
}));

function createMockMessage(body: unknown, attempts: number) {
  return {
    id: crypto.randomUUID(),
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function createMockEnv(): ScoringQueueEnv {
  return {
    DATABASE_URL: 'postgres://test',
    KV: {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace,
    EVENTS: {
      send: vi.fn(),
      sendBatch: vi.fn(),
    } as unknown as Queue,
  };
}

describe('handleScoringQueue DLQ behaviour', () => {
  it('retries when attempts < 3', async () => {
    const env = createMockEnv();
    const msg = createMockMessage(
      {
        type: 'scoring.CalculateScore',
        data: { organizationId: 'org-1', contactId: 'c-1' },
      },
      1,
    );

    const batch = {
      queue: 'test-queue',
      messages: [msg],
    } as unknown as MessageBatch;

    await handleScoringQueue(batch, env);

    expect(msg.retry).toHaveBeenCalled();
    expect(msg.ack).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('sends to DLQ when attempts >= 3', async () => {
    const env = createMockEnv();
    const msg = createMockMessage(
      {
        type: 'scoring.CalculateScore',
        data: { organizationId: 'org-1', contactId: 'c-1' },
      },
      3,
    );

    const batch = {
      queue: 'test-queue',
      messages: [msg],
    } as unknown as MessageBatch;

    await handleScoringQueue(batch, env);

    expect(msg.ack).toHaveBeenCalled();
    expect(msg.retry).not.toHaveBeenCalled();
    expect(env.KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^dlq:/),
      expect.stringContaining('scoring.CalculateScore'),
      expect.objectContaining({ expirationTtl: 7 * 24 * 60 * 60 }),
    );
  });
});
