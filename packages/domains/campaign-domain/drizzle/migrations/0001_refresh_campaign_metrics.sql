ALTER TABLE "campaign"."campaigns"
  ADD COLUMN "delivered_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "click_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "bounce_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "complaint_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "unsubscribe_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "last_event_at" timestamp;

ALTER TABLE "campaign"."campaign_summaries"
  ADD COLUMN "delivered_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "click_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "bounce_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "complaint_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "unsubscribe_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "last_event_at" timestamp;

ALTER TABLE "campaign"."campaign_stats"
  ADD CONSTRAINT "campaign_stats_campaign_org_idx" UNIQUE ("campaign_id", "organization_id");
