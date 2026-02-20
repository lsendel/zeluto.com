CREATE SCHEMA "revops";
--> statement-breakpoint
CREATE TABLE "revops"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"contact_id" uuid,
	"deal_id" uuid,
	"outcome" varchar(50),
	"duration_minutes" integer,
	"notes" text,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid,
	"contact_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"stage" varchar(50) DEFAULT 'prospecting' NOT NULL,
	"value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"assigned_rep" uuid,
	"expected_close_at" timestamp,
	"closed_at" timestamp,
	"lost_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"rep_id" uuid,
	"pipeline_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"best_case_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commit_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closed_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"weighted_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"qualification_score" integer DEFAULT 0 NOT NULL,
	"icp_match" numeric(5, 2) DEFAULT '0' NOT NULL,
	"reasoning" text,
	"recommendation" varchar(30) DEFAULT 'manual_review' NOT NULL,
	"data_completeness" numeric(5, 2) DEFAULT '0' NOT NULL,
	"qualified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."research_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"relevance" numeric(3, 2) NOT NULL,
	"freshness" numeric(3, 2) NOT NULL,
	"source" varchar(100),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"results" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"strategy" varchar(30) NOT NULL,
	"conditions" jsonb,
	"target_reps" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"last_step_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "revops"."sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"steps" jsonb NOT NULL,
	"daily_limits" jsonb,
	"send_window" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revops"."workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"results" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "revops"."workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"conditions" jsonb,
	"actions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
