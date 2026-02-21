import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSegmentChanged } from './segment-event-handler.js';

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

describe('handleSegmentChanged', () => {
  it('starts execution when contact enters matching segment', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'segment',
        config: { type: 'segment', segmentId: 'seg-100' },
      } as any,
    ]);
    vi.mocked(findJourneyById).mockResolvedValue({
      id: 'j-1',
      status: 'active',
    } as any);
    vi.mocked(findActiveExecutionForContact).mockResolvedValue(null);
    vi.mocked(findLatestVersion).mockResolvedValue({ id: 'v-1' } as any);
    vi.mocked(createExecution).mockResolvedValue({ id: 'exec-1' } as any);

    await handleSegmentChanged(
      db,
      {
        type: 'crm.ContactSegmentChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          segmentId: 'seg-100',
          action: 'entered',
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

  it('ignores segment exit events', async () => {
    await handleSegmentChanged(
      db,
      {
        type: 'crm.ContactSegmentChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          segmentId: 'seg-100',
          action: 'exited',
        },
      },
      queue,
    );

    expect(findTriggersByType).not.toHaveBeenCalled();
    expect(createExecution).not.toHaveBeenCalled();
  });

  it('skips non-matching segment IDs', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'segment',
        config: { type: 'segment', segmentId: 'seg-999' },
      } as any,
    ]);

    await handleSegmentChanged(
      db,
      {
        type: 'crm.ContactSegmentChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          segmentId: 'seg-100',
          action: 'entered',
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });

  it('skips when contact already has an active execution', async () => {
    vi.mocked(findTriggersByType).mockResolvedValue([
      {
        id: 't-1',
        journey_id: 'j-1',
        organization_id: 'org-1',
        type: 'segment',
        config: { type: 'segment', segmentId: 'seg-100' },
      } as any,
    ]);
    vi.mocked(findJourneyById).mockResolvedValue({
      id: 'j-1',
      status: 'active',
    } as any);
    vi.mocked(findActiveExecutionForContact).mockResolvedValue({
      id: 'existing',
    } as any);

    await handleSegmentChanged(
      db,
      {
        type: 'crm.ContactSegmentChanged',
        data: {
          organizationId: 'org-1',
          contactId: 'c-1',
          segmentId: 'seg-100',
          action: 'entered',
        },
      },
      queue,
    );

    expect(createExecution).not.toHaveBeenCalled();
  });
});
