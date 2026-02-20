import type {
  OrganizationId,
  UserId,
  ContactId,
  CompanyId,
  CampaignId,
  SegmentId,
  JourneyId,
  JourneyVersionId,
  JourneyStepId,
  DeliveryJobId,
  TemplateId,
  SubscriptionId,
  FormId,
  PageId,
  AssetId,
  WebhookId,
  IntegrationId,
  ReportId,
  DealId,
  SequenceId,
} from '../value-objects/branded-id.js';

export interface DomainEventMetadata {
  id: string; // UUID
  version: number; // Always 1 for now
  sourceContext: string;
  timestamp: string; // ISO 8601
  correlationId: string;
  causationId?: string;
  tenantContext: {
    organizationId: OrganizationId;
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

export interface UserCreatedEvent
  extends DomainEvent<
    'identity.UserCreated',
    {
      organizationId: OrganizationId;
      userId: UserId;
      email: string;
    }
  > {}

export interface UserUpdatedEvent
  extends DomainEvent<
    'identity.UserUpdated',
    {
      organizationId: OrganizationId;
      userId: UserId;
      fields: string[];
    }
  > {}

export interface UserBlockedEvent
  extends DomainEvent<
    'identity.UserBlocked',
    {
      organizationId: OrganizationId;
      userId: UserId;
      reason: string;
    }
  > {}

export interface UserUnblockedEvent
  extends DomainEvent<
    'identity.UserUnblocked',
    {
      organizationId: OrganizationId;
      userId: UserId;
    }
  > {}

export interface OrganizationCreatedEvent
  extends DomainEvent<
    'identity.OrganizationCreated',
    {
      organizationId: OrganizationId;
      ownerId: UserId;
      name: string;
    }
  > {}

export interface OrganizationUpdatedEvent
  extends DomainEvent<
    'identity.OrganizationUpdated',
    {
      organizationId: OrganizationId;
      fields: string[];
    }
  > {}

export interface MemberInvitedEvent
  extends DomainEvent<
    'identity.MemberInvited',
    {
      organizationId: OrganizationId;
      email: string;
      role: string;
      invitedBy: UserId;
    }
  > {}

export interface MemberJoinedEvent
  extends DomainEvent<
    'identity.MemberJoined',
    {
      organizationId: OrganizationId;
      userId: UserId;
      role: string;
    }
  > {}

export interface MemberRemovedEvent
  extends DomainEvent<
    'identity.MemberRemoved',
    {
      organizationId: OrganizationId;
      userId: UserId;
      removedBy: UserId;
    }
  > {}

export interface MemberRoleChangedEvent
  extends DomainEvent<
    'identity.MemberRoleChanged',
    {
      organizationId: OrganizationId;
      userId: UserId;
      fromRole: string;
      toRole: string;
      changedBy: UserId;
    }
  > {}

// ============================================================================
// BILLING EVENTS
// ============================================================================

export interface SubscriptionCreatedEvent
  extends DomainEvent<
    'billing.SubscriptionCreated',
    {
      organizationId: OrganizationId;
      subscriptionId: SubscriptionId;
      plan: string;
      stripeSubscriptionId: string;
    }
  > {}

export interface SubscriptionUpdatedEvent
  extends DomainEvent<
    'billing.SubscriptionUpdated',
    {
      organizationId: OrganizationId;
      subscriptionId: SubscriptionId;
      fields: string[];
    }
  > {}

export interface SubscriptionCanceledEvent
  extends DomainEvent<
    'billing.SubscriptionCanceled',
    {
      organizationId: OrganizationId;
      subscriptionId: SubscriptionId;
      canceledAt: string;
      canceledBy: UserId;
    }
  > {}

export interface SubscriptionExpiredEvent
  extends DomainEvent<
    'billing.SubscriptionExpired',
    {
      organizationId: OrganizationId;
      subscriptionId: SubscriptionId;
      expiredAt: string;
    }
  > {}

export interface PlanChangedEvent
  extends DomainEvent<
    'billing.PlanChanged',
    {
      organizationId: OrganizationId;
      subscriptionId: SubscriptionId;
      fromPlan: string;
      toPlan: string;
      changeType: 'upgrade' | 'downgrade';
    }
  > {}

export interface QuotaExceededEvent
  extends DomainEvent<
    'billing.QuotaExceeded',
    {
      organizationId: OrganizationId;
      resource: string;
      limit: number;
      current: number;
    }
  > {}

export interface QuotaWarningEvent
  extends DomainEvent<
    'billing.QuotaWarning',
    {
      organizationId: OrganizationId;
      resource: string;
      limit: number;
      current: number;
      threshold: number; // 80%
    }
  > {}

export interface InvoicePaidEvent
  extends DomainEvent<
    'billing.InvoicePaid',
    {
      organizationId: OrganizationId;
      invoiceId: string;
      amount: number;
      currency: string;
      paidAt: string;
    }
  > {}

export interface InvoicePaymentFailedEvent
  extends DomainEvent<
    'billing.InvoicePaymentFailed',
    {
      organizationId: OrganizationId;
      invoiceId: string;
      amount: number;
      currency: string;
      reason: string;
    }
  > {}

// ============================================================================
// CRM EVENTS
// ============================================================================

export interface ContactCreatedEvent
  extends DomainEvent<
    'crm.ContactCreated',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      email?: string;
      phone?: string;
    }
  > {}

export interface ContactUpdatedEvent
  extends DomainEvent<
    'crm.ContactUpdated',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      fields: string[];
    }
  > {}

export interface ContactDeletedEvent
  extends DomainEvent<
    'crm.ContactDeleted',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      deletedBy: UserId;
    }
  > {}

export interface ContactMergedEvent
  extends DomainEvent<
    'crm.ContactMerged',
    {
      organizationId: OrganizationId;
      winnerId: string;
      loserId: string;
      mergedBy: UserId;
    }
  > {}

export interface ContactImportedEvent
  extends DomainEvent<
    'crm.ContactImported',
    {
      organizationId: OrganizationId;
      importId: string;
      count: number;
      source: string;
    }
  > {}

export interface CompanyCreatedEvent
  extends DomainEvent<
    'crm.CompanyCreated',
    {
      organizationId: OrganizationId;
      companyId: CompanyId;
      name: string;
    }
  > {}

export interface CompanyUpdatedEvent
  extends DomainEvent<
    'crm.CompanyUpdated',
    {
      organizationId: OrganizationId;
      companyId: CompanyId;
      fields: string[];
    }
  > {}

export interface CompanyDeletedEvent
  extends DomainEvent<
    'crm.CompanyDeleted',
    {
      organizationId: OrganizationId;
      companyId: CompanyId;
      deletedBy: UserId;
    }
  > {}

export interface SegmentCreatedEvent
  extends DomainEvent<
    'crm.SegmentCreated',
    {
      organizationId: OrganizationId;
      segmentId: SegmentId;
      name: string;
      createdBy: UserId;
    }
  > {}

export interface SegmentUpdatedEvent
  extends DomainEvent<
    'crm.SegmentUpdated',
    {
      organizationId: OrganizationId;
      segmentId: SegmentId;
      fields: string[];
    }
  > {}

export interface SegmentRebuiltEvent
  extends DomainEvent<
    'crm.SegmentRebuilt',
    {
      organizationId: OrganizationId;
      segmentId: SegmentId;
      contactCount: number;
      previousCount: number;
    }
  > {}

export interface TagCreatedEvent
  extends DomainEvent<
    'crm.TagCreated',
    {
      organizationId: OrganizationId;
      tagId: string;
      name: string;
    }
  > {}

export interface TagDeletedEvent
  extends DomainEvent<
    'crm.TagDeleted',
    {
      organizationId: OrganizationId;
      tagId: string;
    }
  > {}

export interface ContactTaggedEvent
  extends DomainEvent<
    'crm.ContactTagged',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      tagId: string;
    }
  > {}

export interface ContactUntaggedEvent
  extends DomainEvent<
    'crm.ContactUntagged',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      tagId: string;
    }
  > {}

// ============================================================================
// JOURNEY EVENTS
// ============================================================================

export interface JourneyCreatedEvent
  extends DomainEvent<
    'journey.JourneyCreated',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      name: string;
      createdBy: UserId;
    }
  > {}

export interface JourneyUpdatedEvent
  extends DomainEvent<
    'journey.JourneyUpdated',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      fields: string[];
    }
  > {}

export interface JourneyPublishedEvent
  extends DomainEvent<
    'journey.JourneyPublished',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      versionId: JourneyVersionId;
      publishedBy: UserId;
    }
  > {}

export interface JourneyPausedEvent
  extends DomainEvent<
    'journey.JourneyPaused',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      pausedBy: UserId;
    }
  > {}

export interface JourneyArchivedEvent
  extends DomainEvent<
    'journey.JourneyArchived',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      archivedBy: UserId;
    }
  > {}

export interface ExecutionStartedEvent
  extends DomainEvent<
    'journey.ExecutionStarted',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      contactId: ContactId;
    }
  > {}

export interface ExecutionCompletedEvent
  extends DomainEvent<
    'journey.ExecutionCompleted',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      contactId: ContactId;
      completedAt: string;
    }
  > {}

export interface ExecutionFailedEvent
  extends DomainEvent<
    'journey.ExecutionFailed',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      contactId: ContactId;
      error: string;
    }
  > {}

export interface ExecutionCanceledEvent
  extends DomainEvent<
    'journey.ExecutionCanceled',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      contactId: ContactId;
      canceledBy: UserId;
    }
  > {}

export interface StepExecutedEvent
  extends DomainEvent<
    'journey.StepExecuted',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      stepId: JourneyStepId;
      stepType: string;
      contactId: ContactId;
    }
  > {}

export interface StepFailedEvent
  extends DomainEvent<
    'journey.StepFailed',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      stepId: JourneyStepId;
      contactId: ContactId;
      error: string;
    }
  > {}

export interface StepSkippedEvent
  extends DomainEvent<
    'journey.StepSkipped',
    {
      organizationId: OrganizationId;
      journeyId: JourneyId;
      executionId: string;
      stepId: JourneyStepId;
      contactId: ContactId;
      reason: string;
    }
  > {}

export interface ExecuteNextStepEvent
  extends DomainEvent<
    'journey.ExecuteNextStep',
    {
      organizationId: OrganizationId;
      executionId: string;
      stepId: JourneyStepId;
    }
  > {}

// ============================================================================
// CAMPAIGN EVENTS
// ============================================================================

export interface CampaignCreatedEvent
  extends DomainEvent<
    'campaign.CampaignCreated',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      name: string;
      createdBy: UserId;
    }
  > {}

export interface CampaignScheduledEvent
  extends DomainEvent<
    'campaign.CampaignScheduled',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      scheduledFor: string;
      scheduledBy: UserId;
    }
  > {}

export interface CampaignStartedEvent
  extends DomainEvent<
    'campaign.CampaignStarted',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      startedAt: string;
      targetCount: number;
    }
  > {}

export interface CampaignCompletedEvent
  extends DomainEvent<
    'campaign.CampaignCompleted',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      completedAt: string;
      sentCount: number;
    }
  > {}

export interface CampaignPausedEvent
  extends DomainEvent<
    'campaign.CampaignPaused',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      pausedBy: UserId;
    }
  > {}

export interface CampaignCanceledEvent
  extends DomainEvent<
    'campaign.CampaignCanceled',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      canceledBy: UserId;
    }
  > {}

export interface AbTestStartedEvent
  extends DomainEvent<
    'campaign.AbTestStarted',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      testId: string;
      variants: number;
    }
  > {}

export interface AbTestCompletedEvent
  extends DomainEvent<
    'campaign.AbTestCompleted',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      testId: string;
      winnerId: string;
    }
  > {}

export interface CampaignSentEvent
  extends DomainEvent<
    'campaign.CampaignSent',
    {
      organizationId: OrganizationId;
      campaignId: CampaignId;
      contactCount: number;
    }
  > {}

// ============================================================================
// DELIVERY EVENTS
// ============================================================================

export interface MessageQueuedEvent
  extends DomainEvent<
    'delivery.MessageQueued',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      channel: Channel;
      contactId: ContactId;
      templateId: TemplateId;
      campaignId?: CampaignId;
      journeyExecutionId?: string;
    }
  > {}

export interface MessageSentEvent
  extends DomainEvent<
    'delivery.MessageSent',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      channel: Channel;
      contactId: ContactId;
      provider: string;
      sentAt: string;
    }
  > {}

export interface MessageDeliveredEvent
  extends DomainEvent<
    'delivery.MessageDelivered',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      deliveredAt: string;
    }
  > {}

export interface MessageBouncedEvent
  extends DomainEvent<
    'delivery.MessageBounced',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      bounceType: 'hard' | 'soft';
      reason: string;
    }
  > {}

export interface MessageOpenedEvent
  extends DomainEvent<
    'delivery.MessageOpened',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      openedAt: string;
      userAgent?: string;
    }
  > {}

export interface MessageClickedEvent
  extends DomainEvent<
    'delivery.MessageClicked',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      url: string;
      clickedAt: string;
    }
  > {}

export interface MessageComplainedEvent
  extends DomainEvent<
    'delivery.MessageComplained',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      complainedAt: string;
    }
  > {}

export interface MessageUnsubscribedEvent
  extends DomainEvent<
    'delivery.MessageUnsubscribed',
    {
      organizationId: OrganizationId;
      deliveryJobId: DeliveryJobId;
      contactId: ContactId;
      unsubscribedAt: string;
      listId?: number;
    }
  > {}

export interface ProviderConfiguredEvent
  extends DomainEvent<
    'delivery.ProviderConfigured',
    {
      organizationId: OrganizationId;
      providerId: string;
      providerType: string;
      channel: Channel;
    }
  > {}

export interface ProviderRemovedEvent
  extends DomainEvent<
    'delivery.ProviderRemoved',
    {
      organizationId: OrganizationId;
      providerId: string;
    }
  > {}

export interface DomainAddedEvent
  extends DomainEvent<
    'delivery.DomainAdded',
    {
      organizationId: OrganizationId;
      domain: string;
      addedBy: UserId;
    }
  > {}

export interface DomainVerifiedEvent
  extends DomainEvent<
    'delivery.DomainVerified',
    {
      organizationId: OrganizationId;
      domain: string;
      verifiedAt: string;
    }
  > {}

export interface DomainFailedEvent
  extends DomainEvent<
    'delivery.DomainFailed',
    {
      organizationId: OrganizationId;
      domain: string;
      reason: string;
    }
  > {}

export interface SuppressionAddedEvent
  extends DomainEvent<
    'delivery.SuppressionAdded',
    {
      organizationId: OrganizationId;
      email: string;
      reason: string;
      addedAt: string;
    }
  > {}

export interface SuppressionRemovedEvent
  extends DomainEvent<
    'delivery.SuppressionRemoved',
    {
      organizationId: OrganizationId;
      email: string;
      removedBy: UserId;
    }
  > {}

export interface SendMessageEvent
  extends DomainEvent<
    'delivery.SendMessage',
    {
      organizationId: OrganizationId;
      channel: Channel;
      contactId: ContactId;
      templateId: TemplateId;
      journeyExecutionId?: string;
      campaignId?: CampaignId;
      idempotencyKey: string;
    }
  > {}

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

export interface TemplateCreatedEvent
  extends DomainEvent<
    'content.TemplateCreated',
    {
      organizationId: OrganizationId;
      templateId: TemplateId;
      name: string;
      channel: Channel;
      createdBy: UserId;
    }
  > {}

export interface TemplateUpdatedEvent
  extends DomainEvent<
    'content.TemplateUpdated',
    {
      organizationId: OrganizationId;
      templateId: TemplateId;
      fields: string[];
    }
  > {}

export interface TemplateDeletedEvent
  extends DomainEvent<
    'content.TemplateDeleted',
    {
      organizationId: OrganizationId;
      templateId: TemplateId;
      deletedBy: UserId;
    }
  > {}

export interface FormCreatedEvent
  extends DomainEvent<
    'content.FormCreated',
    {
      organizationId: OrganizationId;
      formId: FormId;
      name: string;
      createdBy: UserId;
    }
  > {}

export interface FormUpdatedEvent
  extends DomainEvent<
    'content.FormUpdated',
    {
      organizationId: OrganizationId;
      formId: FormId;
      fields: string[];
    }
  > {}

export interface FormSubmittedEvent
  extends DomainEvent<
    'content.FormSubmitted',
    {
      organizationId: OrganizationId;
      formId: FormId;
      submissionId: number;
      contactId?: ContactId;
    }
  > {}

export interface LandingPageCreatedEvent
  extends DomainEvent<
    'content.LandingPageCreated',
    {
      organizationId: OrganizationId;
      pageId: PageId;
      name: string;
      createdBy: UserId;
    }
  > {}

export interface LandingPagePublishedEvent
  extends DomainEvent<
    'content.LandingPagePublished',
    {
      organizationId: OrganizationId;
      pageId: PageId;
      publishedBy: UserId;
      publishedAt: string;
    }
  > {}

export interface LandingPageUnpublishedEvent
  extends DomainEvent<
    'content.LandingPageUnpublished',
    {
      organizationId: OrganizationId;
      pageId: PageId;
      unpublishedBy: UserId;
    }
  > {}

export interface AssetUploadedEvent
  extends DomainEvent<
    'content.AssetUploaded',
    {
      organizationId: OrganizationId;
      assetId: AssetId;
      filename: string;
      size: number;
      uploadedBy: UserId;
    }
  > {}

export interface AssetDeletedEvent
  extends DomainEvent<
    'content.AssetDeleted',
    {
      organizationId: OrganizationId;
      assetId: AssetId;
      deletedBy: UserId;
    }
  > {}

export interface PageVisitedEvent
  extends DomainEvent<
    'content.PageVisited',
    {
      organizationId: OrganizationId;
      pageId: PageId;
      contactId?: ContactId;
      visitedAt: string;
    }
  > {}

export interface AssetDownloadedEvent
  extends DomainEvent<
    'content.AssetDownloaded',
    {
      organizationId: OrganizationId;
      assetId: AssetId;
      contactId?: ContactId;
      downloadedAt: string;
    }
  > {}

// ============================================================================
// ANALYTICS EVENTS
// ============================================================================

export interface ReportGeneratedEvent
  extends DomainEvent<
    'analytics.ReportGenerated',
    {
      organizationId: OrganizationId;
      reportId: ReportId;
      reportType: string;
      generatedBy: UserId;
      generatedAt: string;
    }
  > {}

export interface DashboardWidgetCreatedEvent
  extends DomainEvent<
    'analytics.DashboardWidgetCreated',
    {
      organizationId: OrganizationId;
      widgetId: string;
      widgetType: string;
      createdBy: UserId;
    }
  > {}

// ============================================================================
// INTEGRATION EVENTS
// ============================================================================

export interface ConnectionCreatedEvent
  extends DomainEvent<
    'integration.ConnectionCreated',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      integrationType: string;
      createdBy: UserId;
    }
  > {}

export interface ConnectionUpdatedEvent
  extends DomainEvent<
    'integration.ConnectionUpdated',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      fields: string[];
    }
  > {}

export interface ConnectionDeletedEvent
  extends DomainEvent<
    'integration.ConnectionDeleted',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      deletedBy: UserId;
    }
  > {}

export interface ConnectionFailedEvent
  extends DomainEvent<
    'integration.ConnectionFailed',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      error: string;
      failedAt: string;
    }
  > {}

export interface SyncStartedEvent
  extends DomainEvent<
    'integration.SyncStarted',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      syncId: string;
      startedAt: string;
    }
  > {}

export interface SyncCompletedEvent
  extends DomainEvent<
    'integration.SyncCompleted',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      syncId: string;
      recordsProcessed: number;
      completedAt: string;
    }
  > {}

export interface SyncFailedEvent
  extends DomainEvent<
    'integration.SyncFailed',
    {
      organizationId: OrganizationId;
      connectionId: IntegrationId;
      syncId: string;
      error: string;
      failedAt: string;
    }
  > {}

export interface WebhookCreatedEvent
  extends DomainEvent<
    'integration.WebhookCreated',
    {
      organizationId: OrganizationId;
      webhookId: WebhookId;
      url: string;
      events: string[];
      createdBy: UserId;
    }
  > {}

export interface WebhookTriggeredEvent
  extends DomainEvent<
    'integration.WebhookTriggered',
    {
      organizationId: OrganizationId;
      webhookId: WebhookId;
      eventType: string;
      triggeredAt: string;
    }
  > {}

export interface WebhookFailedEvent
  extends DomainEvent<
    'integration.WebhookFailed',
    {
      organizationId: OrganizationId;
      webhookId: WebhookId;
      error: string;
      failedAt: string;
      retryCount: number;
    }
  > {}

export interface WebhookDisabledEvent
  extends DomainEvent<
    'integration.WebhookDisabled',
    {
      organizationId: OrganizationId;
      webhookId: WebhookId;
      reason: string;
      disabledAt: string;
    }
  > {}

// ============================================================================
// LEAD INTELLIGENCE EVENTS
// ============================================================================

export interface LeadEnrichedEvent
  extends DomainEvent<
    'leadIntelligence.LeadEnriched',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      changedFields: string[];
      source: string;
      confidence: number;
    }
  > {}

export interface EnrichmentFailedEvent
  extends DomainEvent<
    'leadIntelligence.EnrichmentFailed',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      provider: string;
      reason: string;
    }
  > {}

export interface DataQualityChangedEvent
  extends DomainEvent<
    'leadIntelligence.DataQualityChanged',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      oldScore: number;
      newScore: number;
    }
  > {}

// ============================================================================
// SCORING & INTENT EVENTS
// ============================================================================

export interface LeadScoredEvent
  extends DomainEvent<
    'scoring.LeadScored',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      score: number;
      grade: string;
      previousScore: number | null;
      topContributors: Array<{ factor: string; points: number }>;
    }
  > {}

export interface ScoreThresholdCrossedEvent
  extends DomainEvent<
    'scoring.ScoreThresholdCrossed',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      threshold: number;
      direction: 'up' | 'down';
      score: number;
    }
  > {}

export interface IntentSignalDetectedEvent
  extends DomainEvent<
    'scoring.IntentSignalDetected',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      signalType: string;
      weight: number;
      source: string;
    }
  > {}

export interface SignalAlertCreatedEvent
  extends DomainEvent<
    'scoring.SignalAlertCreated',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      priority: string;
      deadline: string;
      signalType: string;
    }
  > {}

// ============================================================================
// REVENUE OPERATIONS EVENTS
// ============================================================================

export interface DealCreatedEvent
  extends DomainEvent<
    'revops.DealCreated',
    {
      organizationId: OrganizationId;
      dealId: DealId;
      contactId: ContactId;
      accountId?: string;
      value: number;
      stage: string;
    }
  > {}

export interface DealStageChangedEvent
  extends DomainEvent<
    'revops.DealStageChanged',
    {
      organizationId: OrganizationId;
      dealId: DealId;
      fromStage: string;
      toStage: string;
      changedBy?: UserId;
    }
  > {}

export interface DealWonEvent
  extends DomainEvent<
    'revops.DealWon',
    {
      organizationId: OrganizationId;
      dealId: DealId;
      value: number;
      wonAt: string;
    }
  > {}

export interface DealLostEvent
  extends DomainEvent<
    'revops.DealLost',
    {
      organizationId: OrganizationId;
      dealId: DealId;
      reason: string;
      lostAt: string;
    }
  > {}

export interface ProspectQualifiedEvent
  extends DomainEvent<
    'revops.ProspectQualified',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      qualificationScore: number;
      recommendation: string;
    }
  > {}

export interface SequenceStepExecutedEvent
  extends DomainEvent<
    'revops.SequenceStepExecuted',
    {
      organizationId: OrganizationId;
      sequenceId: SequenceId;
      contactId: ContactId;
      stepIndex: number;
      stepType: string;
    }
  > {}

export interface ResearchCompletedEvent
  extends DomainEvent<
    'revops.ResearchCompleted',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      researchJobId: string;
      insightCount: number;
    }
  > {}

// ============================================================================
// MISC EVENTS
// ============================================================================

export interface PointsAwardedEvent
  extends DomainEvent<
    'misc.PointsAwarded',
    {
      organizationId: OrganizationId;
      contactId: ContactId;
      points: number;
      reason: string;
    }
  > {}

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
  // Scoring & Intent Events
  | LeadScoredEvent
  | ScoreThresholdCrossedEvent
  | IntentSignalDetectedEvent
  | SignalAlertCreatedEvent
  // Revenue Operations Events
  | DealCreatedEvent
  | DealStageChangedEvent
  | DealWonEvent
  | DealLostEvent
  | ProspectQualifiedEvent
  | SequenceStepExecutedEvent
  | ResearchCompletedEvent
  // Misc Events
  | PointsAwardedEvent;
