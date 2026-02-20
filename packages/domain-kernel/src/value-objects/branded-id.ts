import { z } from 'zod';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ContactId = Brand<string, 'ContactId'>;
export type CompanyId = Brand<string, 'CompanyId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type EmailId = Brand<string, 'EmailId'>;
export type FormId = Brand<string, 'FormId'>;
export type PageId = Brand<string, 'PageId'>;
export type AssetId = Brand<string, 'AssetId'>;
export type SegmentId = Brand<string, 'SegmentId'>;
export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type WebhookId = Brand<string, 'WebhookId'>;
export type IntegrationId = Brand<string, 'IntegrationId'>;
export type ReportId = Brand<string, 'ReportId'>;
export type JourneyId = Brand<string, 'JourneyId'>;
export type JourneyVersionId = Brand<string, 'JourneyVersionId'>;
export type JourneyStepId = Brand<string, 'JourneyStepId'>;
export type DeliveryJobId = Brand<string, 'DeliveryJobId'>;
export type TemplateId = Brand<string, 'TemplateId'>;
export type SubscriptionId = Brand<string, 'SubscriptionId'>;
export type PlanId = Brand<string, 'PlanId'>;

// Lead Intelligence IDs
export type EnrichmentJobId = Brand<string, 'EnrichmentJobId'>;
export type EnrichmentProviderId = Brand<string, 'EnrichmentProviderId'>;

// Scoring & Intent IDs
export type LeadScoreId = Brand<string, 'LeadScoreId'>;
export type IntentSignalId = Brand<string, 'IntentSignalId'>;
export type SignalAlertId = Brand<string, 'SignalAlertId'>;
export type ScoringConfigId = Brand<string, 'ScoringConfigId'>;
export type SignalConfigId = Brand<string, 'SignalConfigId'>;
export type ScoreHistoryId = Brand<string, 'ScoreHistoryId'>;

export const ContactIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ContactId>;
export const CompanyIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<CompanyId>;
export const CampaignIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<CampaignId>;
export const EmailIdSchema = z.string().uuid() as unknown as z.ZodType<EmailId>;
export const FormIdSchema = z.string().uuid() as unknown as z.ZodType<FormId>;
export const PageIdSchema = z.string().uuid() as unknown as z.ZodType<PageId>;
export const AssetIdSchema = z.string().uuid() as unknown as z.ZodType<AssetId>;
export const SegmentIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<SegmentId>;
export const UserIdSchema = z.string().uuid() as unknown as z.ZodType<UserId>;
export const OrganizationIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<OrganizationId>;
export const WebhookIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<WebhookId>;
export const IntegrationIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<IntegrationId>;
export const ReportIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ReportId>;
export const JourneyIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<JourneyId>;
export const JourneyVersionIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<JourneyVersionId>;
export const JourneyStepIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<JourneyStepId>;
export const DeliveryJobIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<DeliveryJobId>;
export const TemplateIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<TemplateId>;
export const SubscriptionIdSchema = z
  .string()
  .min(1) as unknown as z.ZodType<SubscriptionId>;
export const PlanIdSchema = z.string().uuid() as unknown as z.ZodType<PlanId>;

// Lead Intelligence ID Schemas
export const EnrichmentJobIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<EnrichmentJobId>;
export const EnrichmentProviderIdSchema = z
  .string()
  .min(1) as unknown as z.ZodType<EnrichmentProviderId>;

// Revenue Operations IDs
export type DealId = Brand<string, 'DealId'>;
export type ForecastId = Brand<string, 'ForecastId'>;
export type RoutingRuleId = Brand<string, 'RoutingRuleId'>;
export type SequenceId = Brand<string, 'SequenceId'>;
export type ProspectId = Brand<string, 'ProspectId'>;
export type ActivityId = Brand<string, 'ActivityId'>;
export type WorkflowId = Brand<string, 'WorkflowId'>;
export type ResearchJobId = Brand<string, 'ResearchJobId'>;

// Scoring & Intent ID Schemas
export const LeadScoreIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<LeadScoreId>;
export const IntentSignalIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<IntentSignalId>;
export const SignalAlertIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<SignalAlertId>;
export const ScoringConfigIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ScoringConfigId>;
export const SignalConfigIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<SignalConfigId>;
export const ScoreHistoryIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ScoreHistoryId>;

// Revenue Operations ID Schemas
export const DealIdSchema = z.string().uuid() as unknown as z.ZodType<DealId>;
export const ForecastIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ForecastId>;
export const RoutingRuleIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<RoutingRuleId>;
export const SequenceIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<SequenceId>;
export const ProspectIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ProspectId>;
export const ActivityIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ActivityId>;
export const WorkflowIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<WorkflowId>;
export const ResearchJobIdSchema = z
  .string()
  .uuid() as unknown as z.ZodType<ResearchJobId>;

// ── Boundary cast helpers ────────────────────────────────────────────
// Use at system boundaries (route params, DB results) to wrap raw strings.
// These are compile-time-only casts — zero runtime cost.

export function asOrganizationId(id: string): OrganizationId { return id as OrganizationId; }
export function asUserId(id: string): UserId { return id as UserId; }
export function asContactId(id: string): ContactId { return id as ContactId; }
export function asCompanyId(id: string): CompanyId { return id as CompanyId; }
export function asCampaignId(id: string): CampaignId { return id as CampaignId; }
export function asSegmentId(id: string): SegmentId { return id as SegmentId; }
export function asJourneyId(id: string): JourneyId { return id as JourneyId; }
export function asJourneyVersionId(id: string): JourneyVersionId { return id as JourneyVersionId; }
export function asJourneyStepId(id: string): JourneyStepId { return id as JourneyStepId; }
export function asEmailId(id: string): EmailId { return id as EmailId; }
export function asFormId(id: string): FormId { return id as FormId; }
export function asPageId(id: string): PageId { return id as PageId; }
export function asAssetId(id: string): AssetId { return id as AssetId; }
export function asWebhookId(id: string): WebhookId { return id as WebhookId; }
export function asIntegrationId(id: string): IntegrationId { return id as IntegrationId; }
export function asReportId(id: string): ReportId { return id as ReportId; }
export function asDeliveryJobId(id: string): DeliveryJobId { return id as DeliveryJobId; }
export function asTemplateId(id: string): TemplateId { return id as TemplateId; }
export function asSubscriptionId(id: string): SubscriptionId { return id as SubscriptionId; }
export function asPlanId(id: string): PlanId { return id as PlanId; }
export function asEnrichmentJobId(id: string): EnrichmentJobId { return id as EnrichmentJobId; }
export function asEnrichmentProviderId(id: string): EnrichmentProviderId { return id as EnrichmentProviderId; }
export function asLeadScoreId(id: string): LeadScoreId { return id as LeadScoreId; }
export function asIntentSignalId(id: string): IntentSignalId { return id as IntentSignalId; }
export function asSignalAlertId(id: string): SignalAlertId { return id as SignalAlertId; }
export function asScoringConfigId(id: string): ScoringConfigId { return id as ScoringConfigId; }
export function asSignalConfigId(id: string): SignalConfigId { return id as SignalConfigId; }
export function asScoreHistoryId(id: string): ScoreHistoryId { return id as ScoreHistoryId; }
export function asDealId(id: string): DealId { return id as DealId; }
export function asForecastId(id: string): ForecastId { return id as ForecastId; }
export function asRoutingRuleId(id: string): RoutingRuleId { return id as RoutingRuleId; }
export function asSequenceId(id: string): SequenceId { return id as SequenceId; }
export function asProspectId(id: string): ProspectId { return id as ProspectId; }
export function asActivityId(id: string): ActivityId { return id as ActivityId; }
export function asWorkflowId(id: string): WorkflowId { return id as WorkflowId; }
export function asResearchJobId(id: string): ResearchJobId { return id as ResearchJobId; }
