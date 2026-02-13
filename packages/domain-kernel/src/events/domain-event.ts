export interface DomainEventMetadata {
  version: number;
  sourceContext: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  tenantContext: {
    organizationId: number;
  };
}

export interface DomainEvent<TType extends string = string, TData = unknown> {
  type: TType;
  data: TData;
  metadata: DomainEventMetadata;
}

// CRM Events
export interface ContactCreatedEvent extends DomainEvent<'ContactCreated', { contactId: number; organizationId: number }> {}
export interface ContactUpdatedEvent extends DomainEvent<'ContactUpdated', { contactId: number; organizationId: number; fields: string[] }> {}
export interface ContactMergedEvent extends DomainEvent<'ContactMerged', { winnerId: number; loserId: number; organizationId: number }> {}
export interface SegmentRebuiltEvent extends DomainEvent<'SegmentRebuilt', { segmentId: number; organizationId: number; contactCount: number }> {}

// Journey Events (from Parcelvoy)
export interface JourneyPublishedEvent extends DomainEvent<'JourneyPublished', { journeyId: number; versionId: number; organizationId: number }> {}
export interface JourneyStepExecutedEvent extends DomainEvent<'JourneyStepExecuted', { journeyId: number; stepId: string; contactId: number; stepType: string; organizationId: number }> {}
export interface JourneyCompletedEvent extends DomainEvent<'JourneyCompleted', { journeyId: number; executionId: string; contactId: number; organizationId: number }> {}
export interface ExecuteNextStepEvent extends DomainEvent<'ExecuteNextStep', { executionId: string; stepId: string; organizationId: number }> {}

// Delivery Events (from BillionMail + Parcelvoy)
export interface SendMessageEvent extends DomainEvent<'SendMessage', { channel: Channel; contactId: number; templateId: number; organizationId: number; journeyExecutionId?: string; campaignId?: number; idempotencyKey: string }> {}
export interface EmailSentEvent extends DomainEvent<'EmailSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}
export interface EmailOpenedEvent extends DomainEvent<'EmailOpened', { deliveryJobId: string; contactId: number; organizationId: number }> {}
export interface EmailClickedEvent extends DomainEvent<'EmailClicked', { deliveryJobId: string; contactId: number; organizationId: number; url: string }> {}
export interface EmailBouncedEvent extends DomainEvent<'EmailBounced', { deliveryJobId: string; contactId: number; organizationId: number; bounceType: 'hard' | 'soft'; reason: string }> {}
export interface SmsSentEvent extends DomainEvent<'SmsSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}
export interface PushSentEvent extends DomainEvent<'PushSent', { deliveryJobId: string; contactId: number; organizationId: number; provider: string }> {}

// Campaign Events
export interface CampaignSentEvent extends DomainEvent<'CampaignSent', { campaignId: number; organizationId: number; contactCount: number }> {}
export interface PointsAwardedEvent extends DomainEvent<'PointsAwarded', { contactId: number; organizationId: number; points: number }> {}

// Content Events
export interface FormSubmittedEvent extends DomainEvent<'FormSubmitted', { formId: number; submissionId: number; organizationId: number; contactId?: number }> {}
export interface PageVisitedEvent extends DomainEvent<'PageVisited', { pageId: number; organizationId: number; contactId?: number }> {}
export interface AssetDownloadedEvent extends DomainEvent<'AssetDownloaded', { assetId: number; organizationId: number; contactId?: number }> {}

// Identity Events
export interface UserCreatedEvent extends DomainEvent<'UserCreated', { userId: number }> {}
export interface OrgCreatedEvent extends DomainEvent<'OrgCreated', { organizationId: number; ownerId: number }> {}
export interface MemberJoinedEvent extends DomainEvent<'MemberJoined', { organizationId: number; userId: number; role: string }> {}

// Billing Events
export interface SubscriptionCreatedEvent extends DomainEvent<'SubscriptionCreated', { organizationId: number; plan: string; stripeSubscriptionId: string }> {}
export interface PlanUpgradedEvent extends DomainEvent<'PlanUpgraded', { organizationId: number; fromPlan: string; toPlan: string }> {}
export interface QuotaExceededEvent extends DomainEvent<'QuotaExceeded', { organizationId: number; resource: string; limit: number; current: number }> {}
export interface PaymentFailedEvent extends DomainEvent<'PaymentFailed', { organizationId: number; invoiceId: string }> {}

export type Channel = 'email' | 'sms' | 'push' | 'webhook';

export type AnyDomainEvent =
  | ContactCreatedEvent | ContactUpdatedEvent | ContactMergedEvent | SegmentRebuiltEvent
  | JourneyPublishedEvent | JourneyStepExecutedEvent | JourneyCompletedEvent | ExecuteNextStepEvent
  | SendMessageEvent | EmailSentEvent | EmailOpenedEvent | EmailClickedEvent | EmailBouncedEvent | SmsSentEvent | PushSentEvent
  | CampaignSentEvent | PointsAwardedEvent
  | FormSubmittedEvent | PageVisitedEvent | AssetDownloadedEvent
  | UserCreatedEvent | OrgCreatedEvent | MemberJoinedEvent
  | SubscriptionCreatedEvent | PlanUpgradedEvent | QuotaExceededEvent | PaymentFailedEvent;
