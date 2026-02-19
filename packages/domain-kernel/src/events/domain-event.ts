export interface DomainEventMetadata {
  id: string; // UUID
  version: number; // Always 1 for now
  sourceContext: string;
  timestamp: string; // ISO 8601
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

// ============================================================================
// IDENTITY EVENTS
// ============================================================================

export interface UserCreatedEvent extends DomainEvent<'identity.UserCreated', {
  organizationId: number;
  userId: number;
  email: string;
}> {}

export interface UserUpdatedEvent extends DomainEvent<'identity.UserUpdated', {
  organizationId: number;
  userId: number;
  fields: string[];
}> {}

export interface UserBlockedEvent extends DomainEvent<'identity.UserBlocked', {
  organizationId: number;
  userId: number;
  reason: string;
}> {}

export interface UserUnblockedEvent extends DomainEvent<'identity.UserUnblocked', {
  organizationId: number;
  userId: number;
}> {}

export interface OrganizationCreatedEvent extends DomainEvent<'identity.OrganizationCreated', {
  organizationId: number;
  ownerId: number;
  name: string;
}> {}

export interface OrganizationUpdatedEvent extends DomainEvent<'identity.OrganizationUpdated', {
  organizationId: number;
  fields: string[];
}> {}

export interface MemberInvitedEvent extends DomainEvent<'identity.MemberInvited', {
  organizationId: number;
  email: string;
  role: string;
  invitedBy: number;
}> {}

export interface MemberJoinedEvent extends DomainEvent<'identity.MemberJoined', {
  organizationId: number;
  userId: number;
  role: string;
}> {}

export interface MemberRemovedEvent extends DomainEvent<'identity.MemberRemoved', {
  organizationId: number;
  userId: number;
  removedBy: number;
}> {}

export interface MemberRoleChangedEvent extends DomainEvent<'identity.MemberRoleChanged', {
  organizationId: number;
  userId: number;
  fromRole: string;
  toRole: string;
  changedBy: number;
}> {}

// ============================================================================
// BILLING EVENTS
// ============================================================================

export interface SubscriptionCreatedEvent extends DomainEvent<'billing.SubscriptionCreated', {
  organizationId: number;
  subscriptionId: string;
  plan: string;
  stripeSubscriptionId: string;
}> {}

export interface SubscriptionUpdatedEvent extends DomainEvent<'billing.SubscriptionUpdated', {
  organizationId: number;
  subscriptionId: string;
  fields: string[];
}> {}

export interface SubscriptionCanceledEvent extends DomainEvent<'billing.SubscriptionCanceled', {
  organizationId: number;
  subscriptionId: string;
  canceledAt: string;
  canceledBy: number;
}> {}

export interface SubscriptionExpiredEvent extends DomainEvent<'billing.SubscriptionExpired', {
  organizationId: number;
  subscriptionId: string;
  expiredAt: string;
}> {}

export interface PlanChangedEvent extends DomainEvent<'billing.PlanChanged', {
  organizationId: number;
  subscriptionId: string;
  fromPlan: string;
  toPlan: string;
  changeType: 'upgrade' | 'downgrade';
}> {}

export interface QuotaExceededEvent extends DomainEvent<'billing.QuotaExceeded', {
  organizationId: number;
  resource: string;
  limit: number;
  current: number;
}> {}

export interface QuotaWarningEvent extends DomainEvent<'billing.QuotaWarning', {
  organizationId: number;
  resource: string;
  limit: number;
  current: number;
  threshold: number; // 80%
}> {}

export interface InvoicePaidEvent extends DomainEvent<'billing.InvoicePaid', {
  organizationId: number;
  invoiceId: string;
  amount: number;
  currency: string;
  paidAt: string;
}> {}

export interface InvoicePaymentFailedEvent extends DomainEvent<'billing.InvoicePaymentFailed', {
  organizationId: number;
  invoiceId: string;
  amount: number;
  currency: string;
  reason: string;
}> {}

// ============================================================================
// CRM EVENTS
// ============================================================================

export interface ContactCreatedEvent extends DomainEvent<'crm.ContactCreated', {
  organizationId: number;
  contactId: number;
  email?: string;
  phone?: string;
}> {}

export interface ContactUpdatedEvent extends DomainEvent<'crm.ContactUpdated', {
  organizationId: number;
  contactId: number;
  fields: string[];
}> {}

export interface ContactDeletedEvent extends DomainEvent<'crm.ContactDeleted', {
  organizationId: number;
  contactId: number;
  deletedBy: number;
}> {}

export interface ContactMergedEvent extends DomainEvent<'crm.ContactMerged', {
  organizationId: number;
  winnerId: number;
  loserId: number;
  mergedBy: number;
}> {}

export interface ContactImportedEvent extends DomainEvent<'crm.ContactImported', {
  organizationId: number;
  importId: string;
  count: number;
  source: string;
}> {}

export interface CompanyCreatedEvent extends DomainEvent<'crm.CompanyCreated', {
  organizationId: number;
  companyId: number;
  name: string;
}> {}

export interface CompanyUpdatedEvent extends DomainEvent<'crm.CompanyUpdated', {
  organizationId: number;
  companyId: number;
  fields: string[];
}> {}

export interface CompanyDeletedEvent extends DomainEvent<'crm.CompanyDeleted', {
  organizationId: number;
  companyId: number;
  deletedBy: number;
}> {}

export interface SegmentCreatedEvent extends DomainEvent<'crm.SegmentCreated', {
  organizationId: number;
  segmentId: number;
  name: string;
  createdBy: number;
}> {}

export interface SegmentUpdatedEvent extends DomainEvent<'crm.SegmentUpdated', {
  organizationId: number;
  segmentId: number;
  fields: string[];
}> {}

export interface SegmentRebuiltEvent extends DomainEvent<'crm.SegmentRebuilt', {
  organizationId: number;
  segmentId: number;
  contactCount: number;
  previousCount: number;
}> {}

export interface TagCreatedEvent extends DomainEvent<'crm.TagCreated', {
  organizationId: number;
  tagId: number;
  name: string;
}> {}

export interface TagDeletedEvent extends DomainEvent<'crm.TagDeleted', {
  organizationId: number;
  tagId: number;
}> {}

export interface ContactTaggedEvent extends DomainEvent<'crm.ContactTagged', {
  organizationId: number;
  contactId: number;
  tagId: number;
}> {}

export interface ContactUntaggedEvent extends DomainEvent<'crm.ContactUntagged', {
  organizationId: number;
  contactId: number;
  tagId: number;
}> {}

// ============================================================================
// JOURNEY EVENTS
// ============================================================================

export interface JourneyCreatedEvent extends DomainEvent<'journey.JourneyCreated', {
  organizationId: number;
  journeyId: number;
  name: string;
  createdBy: number;
}> {}

export interface JourneyUpdatedEvent extends DomainEvent<'journey.JourneyUpdated', {
  organizationId: number;
  journeyId: number;
  fields: string[];
}> {}

export interface JourneyPublishedEvent extends DomainEvent<'journey.JourneyPublished', {
  organizationId: number;
  journeyId: number;
  versionId: number;
  publishedBy: number;
}> {}

export interface JourneyPausedEvent extends DomainEvent<'journey.JourneyPaused', {
  organizationId: number;
  journeyId: number;
  pausedBy: number;
}> {}

export interface JourneyArchivedEvent extends DomainEvent<'journey.JourneyArchived', {
  organizationId: number;
  journeyId: number;
  archivedBy: number;
}> {}

export interface ExecutionStartedEvent extends DomainEvent<'journey.ExecutionStarted', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  contactId: number;
}> {}

export interface ExecutionCompletedEvent extends DomainEvent<'journey.ExecutionCompleted', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  contactId: number;
  completedAt: string;
}> {}

export interface ExecutionFailedEvent extends DomainEvent<'journey.ExecutionFailed', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  contactId: number;
  error: string;
}> {}

export interface ExecutionCanceledEvent extends DomainEvent<'journey.ExecutionCanceled', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  contactId: number;
  canceledBy: number;
}> {}

export interface StepExecutedEvent extends DomainEvent<'journey.StepExecuted', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  stepId: string;
  stepType: string;
  contactId: number;
}> {}

export interface StepFailedEvent extends DomainEvent<'journey.StepFailed', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  stepId: string;
  contactId: number;
  error: string;
}> {}

export interface StepSkippedEvent extends DomainEvent<'journey.StepSkipped', {
  organizationId: number;
  journeyId: number;
  executionId: string;
  stepId: string;
  contactId: number;
  reason: string;
}> {}

export interface ExecuteNextStepEvent extends DomainEvent<'journey.ExecuteNextStep', {
  organizationId: number;
  executionId: string;
  stepId: string;
}> {}

// ============================================================================
// CAMPAIGN EVENTS
// ============================================================================

export interface CampaignCreatedEvent extends DomainEvent<'campaign.CampaignCreated', {
  organizationId: number;
  campaignId: number;
  name: string;
  createdBy: number;
}> {}

export interface CampaignScheduledEvent extends DomainEvent<'campaign.CampaignScheduled', {
  organizationId: number;
  campaignId: number;
  scheduledFor: string;
  scheduledBy: number;
}> {}

export interface CampaignStartedEvent extends DomainEvent<'campaign.CampaignStarted', {
  organizationId: number;
  campaignId: number;
  startedAt: string;
  targetCount: number;
}> {}

export interface CampaignCompletedEvent extends DomainEvent<'campaign.CampaignCompleted', {
  organizationId: number;
  campaignId: number;
  completedAt: string;
  sentCount: number;
}> {}

export interface CampaignPausedEvent extends DomainEvent<'campaign.CampaignPaused', {
  organizationId: number;
  campaignId: number;
  pausedBy: number;
}> {}

export interface CampaignCanceledEvent extends DomainEvent<'campaign.CampaignCanceled', {
  organizationId: number;
  campaignId: number;
  canceledBy: number;
}> {}

export interface AbTestStartedEvent extends DomainEvent<'campaign.AbTestStarted', {
  organizationId: number;
  campaignId: number;
  testId: string;
  variants: number;
}> {}

export interface AbTestCompletedEvent extends DomainEvent<'campaign.AbTestCompleted', {
  organizationId: number;
  campaignId: number;
  testId: string;
  winnerId: string;
}> {}

export interface CampaignSentEvent extends DomainEvent<'campaign.CampaignSent', {
  organizationId: number;
  campaignId: number;
  contactCount: number;
}> {}

// ============================================================================
// DELIVERY EVENTS
// ============================================================================

export interface MessageQueuedEvent extends DomainEvent<'delivery.MessageQueued', {
  organizationId: number;
  deliveryJobId: string;
  channel: Channel;
  contactId: number;
  templateId: number;
  campaignId?: number;
  journeyExecutionId?: string;
}> {}

export interface MessageSentEvent extends DomainEvent<'delivery.MessageSent', {
  organizationId: number;
  deliveryJobId: string;
  channel: Channel;
  contactId: number;
  provider: string;
  sentAt: string;
}> {}

export interface MessageDeliveredEvent extends DomainEvent<'delivery.MessageDelivered', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  deliveredAt: string;
}> {}

export interface MessageBouncedEvent extends DomainEvent<'delivery.MessageBounced', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  bounceType: 'hard' | 'soft';
  reason: string;
}> {}

export interface MessageOpenedEvent extends DomainEvent<'delivery.MessageOpened', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  openedAt: string;
  userAgent?: string;
}> {}

export interface MessageClickedEvent extends DomainEvent<'delivery.MessageClicked', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  url: string;
  clickedAt: string;
}> {}

export interface MessageComplainedEvent extends DomainEvent<'delivery.MessageComplained', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  complainedAt: string;
}> {}

export interface MessageUnsubscribedEvent extends DomainEvent<'delivery.MessageUnsubscribed', {
  organizationId: number;
  deliveryJobId: string;
  contactId: number;
  unsubscribedAt: string;
  listId?: number;
}> {}

export interface ProviderConfiguredEvent extends DomainEvent<'delivery.ProviderConfigured', {
  organizationId: number;
  providerId: string;
  providerType: string;
  channel: Channel;
}> {}

export interface ProviderRemovedEvent extends DomainEvent<'delivery.ProviderRemoved', {
  organizationId: number;
  providerId: string;
}> {}

export interface DomainAddedEvent extends DomainEvent<'delivery.DomainAdded', {
  organizationId: number;
  domain: string;
  addedBy: number;
}> {}

export interface DomainVerifiedEvent extends DomainEvent<'delivery.DomainVerified', {
  organizationId: number;
  domain: string;
  verifiedAt: string;
}> {}

export interface DomainFailedEvent extends DomainEvent<'delivery.DomainFailed', {
  organizationId: number;
  domain: string;
  reason: string;
}> {}

export interface SuppressionAddedEvent extends DomainEvent<'delivery.SuppressionAdded', {
  organizationId: number;
  email: string;
  reason: string;
  addedAt: string;
}> {}

export interface SuppressionRemovedEvent extends DomainEvent<'delivery.SuppressionRemoved', {
  organizationId: number;
  email: string;
  removedBy: number;
}> {}

export interface SendMessageEvent extends DomainEvent<'delivery.SendMessage', {
  organizationId: number;
  channel: Channel;
  contactId: number;
  templateId: number;
  journeyExecutionId?: string;
  campaignId?: number;
  idempotencyKey: string;
}> {}

// Legacy aliases for backward compatibility
export interface EmailSentEvent extends MessageSentEvent {}
export interface EmailOpenedEvent extends MessageOpenedEvent {}
export interface EmailClickedEvent extends MessageClickedEvent {}
export interface EmailBouncedEvent extends MessageBouncedEvent {}
export interface SmsSentEvent extends MessageSentEvent {}
export interface PushSentEvent extends MessageSentEvent {}

// ============================================================================
// CONTENT EVENTS
// ============================================================================

export interface TemplateCreatedEvent extends DomainEvent<'content.TemplateCreated', {
  organizationId: number;
  templateId: number;
  name: string;
  channel: Channel;
  createdBy: number;
}> {}

export interface TemplateUpdatedEvent extends DomainEvent<'content.TemplateUpdated', {
  organizationId: number;
  templateId: number;
  fields: string[];
}> {}

export interface TemplateDeletedEvent extends DomainEvent<'content.TemplateDeleted', {
  organizationId: number;
  templateId: number;
  deletedBy: number;
}> {}

export interface FormCreatedEvent extends DomainEvent<'content.FormCreated', {
  organizationId: number;
  formId: number;
  name: string;
  createdBy: number;
}> {}

export interface FormUpdatedEvent extends DomainEvent<'content.FormUpdated', {
  organizationId: number;
  formId: number;
  fields: string[];
}> {}

export interface FormSubmittedEvent extends DomainEvent<'content.FormSubmitted', {
  organizationId: number;
  formId: number;
  submissionId: number;
  contactId?: number;
}> {}

export interface LandingPageCreatedEvent extends DomainEvent<'content.LandingPageCreated', {
  organizationId: number;
  pageId: number;
  name: string;
  createdBy: number;
}> {}

export interface LandingPagePublishedEvent extends DomainEvent<'content.LandingPagePublished', {
  organizationId: number;
  pageId: number;
  publishedBy: number;
  publishedAt: string;
}> {}

export interface LandingPageUnpublishedEvent extends DomainEvent<'content.LandingPageUnpublished', {
  organizationId: number;
  pageId: number;
  unpublishedBy: number;
}> {}

export interface AssetUploadedEvent extends DomainEvent<'content.AssetUploaded', {
  organizationId: number;
  assetId: number;
  filename: string;
  size: number;
  uploadedBy: number;
}> {}

export interface AssetDeletedEvent extends DomainEvent<'content.AssetDeleted', {
  organizationId: number;
  assetId: number;
  deletedBy: number;
}> {}

export interface PageVisitedEvent extends DomainEvent<'content.PageVisited', {
  organizationId: number;
  pageId: number;
  contactId?: number;
  visitedAt: string;
}> {}

export interface AssetDownloadedEvent extends DomainEvent<'content.AssetDownloaded', {
  organizationId: number;
  assetId: number;
  contactId?: number;
  downloadedAt: string;
}> {}

// ============================================================================
// ANALYTICS EVENTS
// ============================================================================

export interface ReportGeneratedEvent extends DomainEvent<'analytics.ReportGenerated', {
  organizationId: number;
  reportId: string;
  reportType: string;
  generatedBy: number;
  generatedAt: string;
}> {}

export interface DashboardWidgetCreatedEvent extends DomainEvent<'analytics.DashboardWidgetCreated', {
  organizationId: number;
  widgetId: string;
  widgetType: string;
  createdBy: number;
}> {}

// ============================================================================
// INTEGRATION EVENTS
// ============================================================================

export interface ConnectionCreatedEvent extends DomainEvent<'integration.ConnectionCreated', {
  organizationId: number;
  connectionId: string;
  integrationType: string;
  createdBy: number;
}> {}

export interface ConnectionUpdatedEvent extends DomainEvent<'integration.ConnectionUpdated', {
  organizationId: number;
  connectionId: string;
  fields: string[];
}> {}

export interface ConnectionDeletedEvent extends DomainEvent<'integration.ConnectionDeleted', {
  organizationId: number;
  connectionId: string;
  deletedBy: number;
}> {}

export interface ConnectionFailedEvent extends DomainEvent<'integration.ConnectionFailed', {
  organizationId: number;
  connectionId: string;
  error: string;
  failedAt: string;
}> {}

export interface SyncStartedEvent extends DomainEvent<'integration.SyncStarted', {
  organizationId: number;
  connectionId: string;
  syncId: string;
  startedAt: string;
}> {}

export interface SyncCompletedEvent extends DomainEvent<'integration.SyncCompleted', {
  organizationId: number;
  connectionId: string;
  syncId: string;
  recordsProcessed: number;
  completedAt: string;
}> {}

export interface SyncFailedEvent extends DomainEvent<'integration.SyncFailed', {
  organizationId: number;
  connectionId: string;
  syncId: string;
  error: string;
  failedAt: string;
}> {}

export interface WebhookCreatedEvent extends DomainEvent<'integration.WebhookCreated', {
  organizationId: number;
  webhookId: string;
  url: string;
  events: string[];
  createdBy: number;
}> {}

export interface WebhookTriggeredEvent extends DomainEvent<'integration.WebhookTriggered', {
  organizationId: number;
  webhookId: string;
  eventType: string;
  triggeredAt: string;
}> {}

export interface WebhookFailedEvent extends DomainEvent<'integration.WebhookFailed', {
  organizationId: number;
  webhookId: string;
  error: string;
  failedAt: string;
  retryCount: number;
}> {}

export interface WebhookDisabledEvent extends DomainEvent<'integration.WebhookDisabled', {
  organizationId: number;
  webhookId: string;
  reason: string;
  disabledAt: string;
}> {}

// ============================================================================
// LEAD INTELLIGENCE EVENTS
// ============================================================================

export interface LeadEnrichedEvent extends DomainEvent<'leadIntelligence.LeadEnriched', {
  organizationId: number;
  contactId: string;
  changedFields: string[];
  source: string;
  confidence: number;
}> {}

export interface EnrichmentFailedEvent extends DomainEvent<'leadIntelligence.EnrichmentFailed', {
  organizationId: number;
  contactId: string;
  provider: string;
  reason: string;
}> {}

export interface DataQualityChangedEvent extends DomainEvent<'leadIntelligence.DataQualityChanged', {
  organizationId: number;
  contactId: string;
  oldScore: number;
  newScore: number;
}> {}

// ============================================================================
// MISC EVENTS
// ============================================================================

export interface PointsAwardedEvent extends DomainEvent<'misc.PointsAwarded', {
  organizationId: number;
  contactId: number;
  points: number;
  reason: string;
}> {}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Channel = 'email' | 'sms' | 'push' | 'webhook';

export type AnyDomainEvent =
  // Identity Events
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserBlockedEvent
  | UserUnblockedEvent
  | OrganizationCreatedEvent
  | OrganizationUpdatedEvent
  | MemberInvitedEvent
  | MemberJoinedEvent
  | MemberRemovedEvent
  | MemberRoleChangedEvent
  // Billing Events
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionExpiredEvent
  | PlanChangedEvent
  | QuotaExceededEvent
  | QuotaWarningEvent
  | InvoicePaidEvent
  | InvoicePaymentFailedEvent
  // CRM Events
  | ContactCreatedEvent
  | ContactUpdatedEvent
  | ContactDeletedEvent
  | ContactMergedEvent
  | ContactImportedEvent
  | CompanyCreatedEvent
  | CompanyUpdatedEvent
  | CompanyDeletedEvent
  | SegmentCreatedEvent
  | SegmentUpdatedEvent
  | SegmentRebuiltEvent
  | TagCreatedEvent
  | TagDeletedEvent
  | ContactTaggedEvent
  | ContactUntaggedEvent
  // Journey Events
  | JourneyCreatedEvent
  | JourneyUpdatedEvent
  | JourneyPublishedEvent
  | JourneyPausedEvent
  | JourneyArchivedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionCanceledEvent
  | StepExecutedEvent
  | StepFailedEvent
  | StepSkippedEvent
  | ExecuteNextStepEvent
  // Campaign Events
  | CampaignCreatedEvent
  | CampaignScheduledEvent
  | CampaignStartedEvent
  | CampaignCompletedEvent
  | CampaignPausedEvent
  | CampaignCanceledEvent
  | AbTestStartedEvent
  | AbTestCompletedEvent
  | CampaignSentEvent
  // Delivery Events
  | MessageQueuedEvent
  | MessageSentEvent
  | MessageDeliveredEvent
  | MessageBouncedEvent
  | MessageOpenedEvent
  | MessageClickedEvent
  | MessageComplainedEvent
  | MessageUnsubscribedEvent
  | ProviderConfiguredEvent
  | ProviderRemovedEvent
  | DomainAddedEvent
  | DomainVerifiedEvent
  | DomainFailedEvent
  | SuppressionAddedEvent
  | SuppressionRemovedEvent
  | SendMessageEvent
  // Content Events
  | TemplateCreatedEvent
  | TemplateUpdatedEvent
  | TemplateDeletedEvent
  | FormCreatedEvent
  | FormUpdatedEvent
  | FormSubmittedEvent
  | LandingPageCreatedEvent
  | LandingPagePublishedEvent
  | LandingPageUnpublishedEvent
  | AssetUploadedEvent
  | AssetDeletedEvent
  | PageVisitedEvent
  | AssetDownloadedEvent
  // Analytics Events
  | ReportGeneratedEvent
  | DashboardWidgetCreatedEvent
  // Integration Events
  | ConnectionCreatedEvent
  | ConnectionUpdatedEvent
  | ConnectionDeletedEvent
  | ConnectionFailedEvent
  | SyncStartedEvent
  | SyncCompletedEvent
  | SyncFailedEvent
  | WebhookCreatedEvent
  | WebhookTriggeredEvent
  | WebhookFailedEvent
  | WebhookDisabledEvent
  // Lead Intelligence Events
  | LeadEnrichedEvent
  | EnrichmentFailedEvent
  | DataQualityChangedEvent
  // Misc Events
  | PointsAwardedEvent;
