// Common schemas

// Analytics contract & schemas
export {
  analyticsContract,
  CampaignDailyStatsSchema,
  CampaignPerformanceSchema,
  ContactActivitySchema,
  DashboardWidgetSchema,
  EventAggregateSchema,
  JourneyDailyStatsSchema,
  JourneyPerformanceSchema,
  OverviewStatsSchema,
  ReportResultSchema,
  ReportSchema,
} from './analytics.contract';
// Billing contract & schemas
export {
  billingContract,
  PlanSchema,
  SubscriptionSchema,
  UsageSchema,
} from './billing.contract';
// Campaign contract & schemas
export {
  AbTestSchema,
  CampaignSchema,
  CampaignStatsSchema,
  CampaignVersionSchema,
  campaignContract,
} from './campaign.contract';
export {
  ErrorSchema,
  IdParamSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
  StringIdParamSchema,
} from './common';
// Content contract & schemas
export {
  AssetSchema,
  contentContract,
  FormSchema,
  FormSubmissionSchema,
  LandingPageSchema,
  TemplateSchema,
  TemplateVersionSchema,
} from './content.contract';
// CRM contract & schemas
export {
  CompanySchema,
  ContactSchema,
  crmContract,
  SegmentSchema,
} from './crm.contract';
// Delivery contract & schemas
export {
  DeliveryJobSchema,
  DeliveryMessageSchema,
  deliveryContract,
  ProviderSchema,
  TrackingEventSchema,
} from './delivery.contract';
// Identity contract & schemas
export {
  identityContract,
  OrganizationSchema,
  OrgMemberSchema,
  SessionSchema,
  UserSchema,
} from './identity.contract';
// Integrations contract & schemas
export {
  ConnectionSchema,
  integrationsContract,
  SyncJobSchema,
  WebhookDeliverySchema,
  WebhookSchema,
} from './integrations.contract';
// Journey contract & schemas
export {
  JourneySchema,
  JourneyStepSchema,
  JourneyVersionSchema,
  journeyContract,
} from './journey.contract';
// Lead Intelligence contract & schemas
export {
  EnrichmentJobSchema,
  EnrichmentProviderSchema,
  LeadIntelligenceDataQualityScoreSchema,
  LeadIntelligenceProviderHealthSchema,
  leadIntelligenceContract,
  WaterfallConfigSchema,
} from './lead-intelligence.contract';

// Revenue Operations contract & schemas
export {
  RevOpsActivitySchema,
  RevOpsDealSchema,
  RevOpsForecastSchema,
  RevOpsInsightSchema,
  RevOpsPipelineMetricsSchema,
  RevOpsProspectSchema,
  RevOpsSequenceSchema,
  revopsContract,
} from './revops.contract';
// Scoring contract & schemas
export {
  IntentSignalSchema,
  LeadScoreSchema,
  ScoreHistoryEntrySchema,
  ScoringConfigEntrySchema,
  SignalAlertSchema,
  scoringContract,
} from './scoring.contract';
