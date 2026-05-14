CREATE TYPE "public"."economic_event_impact" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "economic_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text,
	"impact" "economic_event_impact" DEFAULT 'medium' NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"notes" text,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bot_subscribed_briefing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bot_subscribed_events" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economic_events_event_at_idx" ON "economic_events" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economic_events_notified_idx" ON "economic_events" USING btree ("notified_at");