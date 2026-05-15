ALTER TABLE "formations" ADD COLUMN "daily_capacity" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ical_token" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_ical_token_unique" UNIQUE("ical_token");