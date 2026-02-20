CREATE SCHEMA "lead_intelligence";
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."enrichment_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"job_id" uuid,
	"field_name" varchar(50) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"provider_id" varchar(50) NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."enrichment_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"field_name" varchar(50) NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"value" jsonb,
	"confidence" numeric(3, 2) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."enrichment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"field_requests" jsonb NOT NULL,
	"results" jsonb,
	"total_cost" numeric(10, 4) DEFAULT '0',
	"total_latency_ms" integer DEFAULT 0,
	"providers_tried" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."enrichment_providers" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"supported_fields" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"cost_per_lookup" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_latency_ms" integer DEFAULT 0,
	"success_rate" numeric(5, 4) DEFAULT '0',
	"batch_supported" boolean DEFAULT false,
	"config" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."provider_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp,
	"last_success_at" timestamp,
	"circuit_state" varchar(20) DEFAULT 'closed' NOT NULL,
	"circuit_opened_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intelligence"."waterfall_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"field_name" varchar(50) NOT NULL,
	"provider_order" jsonb NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"timeout_ms" integer DEFAULT 5000 NOT NULL,
	"min_confidence" numeric(3, 2) DEFAULT '0.5' NOT NULL,
	"cache_ttl_days" integer DEFAULT 7 NOT NULL,
	"max_cost_per_lead" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
