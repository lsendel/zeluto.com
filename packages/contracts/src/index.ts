// Common schemas
export {
  PaginationQuerySchema,
  PaginatedResponseSchema,
  ErrorSchema,
  IdParamSchema,
  StringIdParamSchema,
} from './common';

// Identity contract & schemas
export {
  identityContract,
  UserSchema,
  OrganizationSchema,
  OrgMemberSchema,
  SessionSchema,
} from './identity.contract';

// Billing contract & schemas
export {
  billingContract,
  PlanSchema,
  SubscriptionSchema,
  UsageSchema,
} from './billing.contract';

// CRM contract & schemas
export {
  crmContract,
  ContactSchema,
  CompanySchema,
  SegmentSchema,
} from './crm.contract';

// Journey contract & schemas
export {
  journeyContract,
  JourneySchema,
  JourneyStepSchema,
  JourneyVersionSchema,
} from './journey.contract';

// Delivery contract & schemas
export {
  deliveryContract,
  DeliveryMessageSchema,
  DeliveryJobSchema,
  ProviderSchema,
  TrackingEventSchema,
} from './delivery.contract';

// Campaign contract & schemas
export {
  campaignContract,
  CampaignSchema,
  CampaignVersionSchema,
  CampaignStatsSchema,
  AbTestSchema,
} from './campaign.contract';

// Content contract & schemas
export {
  contentContract,
  TemplateSchema,
  TemplateVersionSchema,
  FormSchema,
  FormSubmissionSchema,
  LandingPageSchema,
  AssetSchema,
} from './content.contract';

// Analytics contract & schemas
export {
  analyticsContract,
  EventAggregateSchema,
  ContactActivitySchema,
  CampaignDailyStatsSchema,
  JourneyDailyStatsSchema,
  ReportSchema,
  DashboardWidgetSchema,
  OverviewStatsSchema,
  CampaignPerformanceSchema,
  JourneyPerformanceSchema,
  ReportResultSchema,
} from './analytics.contract';

// Lead Intelligence contract & schemas
export {
  leadIntelligenceContract,
  EnrichmentProviderSchema,
  EnrichmentJobSchema,
  LeadIntelligenceProviderHealthSchema,
  WaterfallConfigSchema,
  LeadIntelligenceDataQualityScoreSchema,
} from './lead-intelligence.contract';

// Scoring contract & schemas
export {
  scoringContract,
  LeadScoreSchema,
  ScoreHistoryEntrySchema,
  IntentSignalSchema,
  SignalAlertSchema,
  ScoringConfigEntrySchema,
} from './scoring.contract';

// Revenue Operations contract & schemas
export {
  revopsContract,
  RevOpsDealSchema,
  RevOpsActivitySchema,
  RevOpsForecastSchema,
  RevOpsProspectSchema,
  RevOpsSequenceSchema,
  RevOpsInsightSchema,
  RevOpsPipelineMetricsSchema,
} from './revops.contract';

// Integrations contract & schemas
export {
  integrationsContract,
  ConnectionSchema,
  SyncJobSchema,
  WebhookSchema,
  WebhookDeliverySchema,
} from './integrations.contract';
