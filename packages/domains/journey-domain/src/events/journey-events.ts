import type { DomainEvent } from '@mauntic/domain-kernel';

// ============================================================================
// JOURNEY DEFINITION EVENTS
// ============================================================================

export interface JourneyPublishedEvent
  extends DomainEvent<
    'journey.JourneyPublished',
    {
      organizationId: string;
      journeyId: string;
      versionId: string; // The version that was published
      publishedAt: string;
    }
  > {}

export interface JourneyPausedEvent
  extends DomainEvent<
    'journey.JourneyPaused',
    {
      organizationId: string;
      journeyId: string;
      pausedAt: string;
    }
  > {}

export interface JourneyResumedEvent
  extends DomainEvent<
    'journey.JourneyResumed',
    {
      organizationId: string;
      journeyId: string;
      resumedAt: string;
    }
  > {}

export interface JourneyArchivedEvent
  extends DomainEvent<
    'journey.JourneyArchived',
    {
      organizationId: string;
      journeyId: string;
      archivedAt: string;
    }
  > {}

// ============================================================================
// JOURNEY EXECUTION EVENTS
// ============================================================================

export interface JourneyExecutionCompletedEvent
  extends DomainEvent<
    'journey.ExecutionCompleted',
    {
      organizationId: string;
      journeyId: string;
      executionId: string;
      contactId: string;
      completedAt: string;
    }
  > {}

export interface JourneyExecutionFailedEvent
  extends DomainEvent<
    'journey.ExecutionFailed',
    {
      organizationId: string;
      journeyId: string;
      executionId: string;
      contactId: string;
      reason: string;
      failedAt: string;
    }
  > {}

export interface JourneyExecutionCanceledEvent
  extends DomainEvent<
    'journey.ExecutionCanceled',
    {
      organizationId: string;
      journeyId: string;
      executionId: string;
      contactId: string;
      canceledAt: string;
    }
  > {}

export interface JourneyExecutionStepChangedEvent
  extends DomainEvent<
    'journey.ExecutionStepChanged',
    {
      organizationId: string;
      journeyId: string;
      executionId: string;
      contactId: string;
      fromStepId: string | null;
      toStepId: string;
      changedAt: string;
    }
  > {}
