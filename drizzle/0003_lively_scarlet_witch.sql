ALTER TABLE "vip_applications" ADD COLUMN "reminder_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vip_applications" ADD COLUMN "reminder_sent_at" timestamp;