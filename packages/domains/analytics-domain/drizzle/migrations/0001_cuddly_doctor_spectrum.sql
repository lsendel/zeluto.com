CREATE TABLE "analytics"."daily_score_distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"avg_score" numeric(5, 2) NOT NULL,
	"min_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"p50" integer NOT NULL,
	"p90" integer NOT NULL,
	"p95" integer NOT NULL,
	"total_contacts" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."engagement_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"grade" varchar(5) NOT NULL,
	"count" integer NOT NULL,
	"avg_open_rate" numeric(5, 2) NOT NULL,
	"avg_click_rate" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."enrichment_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"total_enriched" integer NOT NULL,
	"success_rate" numeric(5, 2) NOT NULL,
	"avg_cost" numeric(8, 4) NOT NULL,
	"avg_freshness" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."score_trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"date" date NOT NULL,
	"score_value" integer NOT NULL
);
