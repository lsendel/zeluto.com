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

export const ContactIdSchema = z.string().uuid() as unknown as z.ZodType<ContactId>;
export const CompanyIdSchema = z.string().uuid() as unknown as z.ZodType<CompanyId>;
export const CampaignIdSchema = z.string().uuid() as unknown as z.ZodType<CampaignId>;
export const EmailIdSchema = z.string().uuid() as unknown as z.ZodType<EmailId>;
export const FormIdSchema = z.string().uuid() as unknown as z.ZodType<FormId>;
export const PageIdSchema = z.string().uuid() as unknown as z.ZodType<PageId>;
export const AssetIdSchema = z.string().uuid() as unknown as z.ZodType<AssetId>;
export const SegmentIdSchema = z.string().uuid() as unknown as z.ZodType<SegmentId>;
export const UserIdSchema = z.string().uuid() as unknown as z.ZodType<UserId>;
export const OrganizationIdSchema = z.string().uuid() as unknown as z.ZodType<OrganizationId>;
export const WebhookIdSchema = z.string().uuid() as unknown as z.ZodType<WebhookId>;
export const IntegrationIdSchema = z.string().uuid() as unknown as z.ZodType<IntegrationId>;
export const ReportIdSchema = z.string().uuid() as unknown as z.ZodType<ReportId>;
export const JourneyIdSchema = z.string().uuid() as unknown as z.ZodType<JourneyId>;
export const JourneyVersionIdSchema = z.string().uuid() as unknown as z.ZodType<JourneyVersionId>;
export const JourneyStepIdSchema = z.string().uuid() as unknown as z.ZodType<JourneyStepId>;
export const DeliveryJobIdSchema = z.string().uuid() as unknown as z.ZodType<DeliveryJobId>;
export const TemplateIdSchema = z.string().uuid() as unknown as z.ZodType<TemplateId>;
export const SubscriptionIdSchema = z.string().min(1) as unknown as z.ZodType<SubscriptionId>;
export const PlanIdSchema = z.string().uuid() as unknown as z.ZodType<PlanId>;

// Lead Intelligence ID Schemas
export const EnrichmentJobIdSchema = z.string().uuid() as unknown as z.ZodType<EnrichmentJobId>;
export const EnrichmentProviderIdSchema = z.string().min(1) as unknown as z.ZodType<EnrichmentProviderId>;

// Scoring & Intent ID Schemas
export const LeadScoreIdSchema = z.string().uuid() as unknown as z.ZodType<LeadScoreId>;
export const IntentSignalIdSchema = z.string().uuid() as unknown as z.ZodType<IntentSignalId>;
export const SignalAlertIdSchema = z.string().uuid() as unknown as z.ZodType<SignalAlertId>;
