import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleIntentDetected,
  handleScoreChanged,
} from './score-event-handler.js';

vi.mock('../infrastructure/repositories/trigger-repository.js', () => ({
  findTriggersByType: vi.fn(),
}));
vi.mock('../infrastructure/repositories/journey-repository.js', () => ({
  findJourneyById: vi.fn(),
}));
vi.mock('../infrastructure/repositories/execution-repository.js', () => ({
  findActiveExecutionForContact: vi.fn(),
  createExecution: vi.fn(),
}));
vi.mock('../infrastructure/repositories/version-repository.js', () => ({
  findLatestVersion: vi.fn(),
}));

import { findTriggersByType } from '../infrastructure/repositories/trigger-repository.js';
import { findJourneyById } from '../infrastructure/repositories/journey-repository.js';
import {
  findActiveExecutionForContact,
  createExecution,
} from '../infrastructure/repositories/execution-repository.js';
import { findLatestVersion } from '../infrastructure/repositories/version-repository.js';

const db = {} as any;
const queue = { send: vi.fn() } as unknown as Queue;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleScoreChanged', () => {
  it('starts execution when score meets gte threshold', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'score',
        config: { type: 'score', operator: 'gte', threshold: 80 },
      } as any,
    ]);
    vi.mocked(findJourneyById).mockResolvedValue({
      id: 'j-1',
      status: 'active',
    } as any);
    vi.mocked(findActiveExecutionForContact).mockResolvedValue(null);
    vi.mocked(findLatestVersion).mockResolvedValue({ id: 'v-1' } as any);
    vi.mocked(createExecution).mockResolvedValue({ id: 'exec-1' } as any);

    await handleScoreChanged(
      db,
      {
        type: 'scoring.ScoreChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          score: 85,
          previousScore: 70,
        },
      },
      queue,
    );

    expect(createExecution).toHaveBeenCalledWith(db, 'org-1', {
      journey_id: 'j-1',
      journey_version_id: 'v-1',
      contact_id: 'c-1',
      status: 'active',
    });
    expect(queue.send).toHaveBeenCalled();
  });

  it('skips when score does not meet threshold', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'score',
        config: { type: 'score', operator: 'gte', threshold: 80 },
      } as any,
    ]);

    await handleScoreChanged(
      db,
      {
        type: 'scoring.ScoreChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          score: 50,
          previousScore: 40,
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });

  it('skips inactive journeys', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'score',
        config: { type: 'score', operator: 'gte', threshold: 50 },
      } as any,
    ]);
    vi.mocked(findJourneyById).mockResolvedValue({
      id: 'j-1',
      status: 'paused',
    } as any);

    await handleScoreChanged(
      db,
      {
        type: 'scoring.ScoreChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          score: 90,
          previousScore: 40,
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });
});

describe('handleIntentDetected', () => {
  it('starts execution when intent type matches and strength meets minimum', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-2',
        journey_id: 'j-2',
        organization_id: 'org-1',
        type: 'intent',
        config: {
          type: 'intent',
          intentType: 'purchase_intent',
          minStrength: 60,
        },
      } as any,
    ]);
    vi.mocked(findJourneyById).mockResolvedValue({
      id: 'j-2',
      status: 'active',
    } as any);
    vi.mocked(findActiveExecutionForContact).mockResolvedValue(null);
    vi.mocked(findLatestVersion).mockResolvedValue({ id: 'v-2' } as any);
    vi.mocked(createExecution).mockResolvedValue({ id: 'exec-2' } as any);

    await handleIntentDetected(
      db,
      {
        type: 'scoring.IntentDetected',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          intentType: 'purchase_intent',
          strength: 75,
        },
      },
      queue,
    );

    expect(createExecution).toHaveBeenCalled();
    expect(queue.send).toHaveBeenCalled();
  });

  it('skips when intent type does not match', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-2',
        journey_id: 'j-2',
        organization_id: 'org-1',
        type: 'intent',
        config: {
          type: 'intent',
          intentType: 'purchase_intent',
          minStrength: 60,
        },
      } as any,
    ]);

    await handleIntentDetected(
      db,
      {
        type: 'scoring.IntentDetected',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          intentType: 'churn_risk',
          strength: 90,
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });

  it('skips when strength is below minimum', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-2',
        journey_id: 'j-2',
        organization_id: 'org-1',
        type: 'intent',
        config: {
          type: 'intent',
          intentType: 'purchase_intent',
          minStrength: 60,
        },
      } as any,
    ]);

    await handleIntentDetected(
      db,
      {
        type: 'scoring.IntentDetected',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          intentType: 'purchase_intent',
          strength: 30,
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });
});
