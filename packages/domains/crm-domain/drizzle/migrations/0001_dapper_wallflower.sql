CREATE TABLE "crm"."outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "crm"."contacts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "lead_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "lead_grade" varchar(1);--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "intent_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "enrichment_status" varchar(20);--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "last_enriched_at" timestamp;--> statement-breakpoint
ALTER TABLE "crm"."contacts" ADD COLUMN "data_quality_score" numeric(3, 2);