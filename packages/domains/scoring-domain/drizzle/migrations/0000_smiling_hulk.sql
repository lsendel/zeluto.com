CREATE SCHEMA "scoring";
--> statement-breakpoint
CREATE TABLE "scoring"."intent_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"source" varchar(100) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"decay_model" varchar(20) DEFAULT 'linear' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring"."lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"grade" varchar(2) DEFAULT 'F' NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"fit_score" integer DEFAULT 0 NOT NULL,
	"intent_score" integer DEFAULT 0 NOT NULL,
	"components" jsonb,
	"top_contributors" jsonb,
	"scored_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring"."score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"date" date NOT NULL,
	"total_score" integer NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"fit_score" integer DEFAULT 0 NOT NULL,
	"intent_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring"."scoring_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"factor" varchar(100) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring"."signal_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"deadline" timestamp NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring"."signal_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"decay_hours" integer DEFAULT 168 NOT NULL,
	"tier" varchar(20) DEFAULT 'medium' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
