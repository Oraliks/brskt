CREATE TABLE IF NOT EXISTS "formation_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "formation_mode" NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"telegram_id" bigint,
	"notes" text,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "formation_waitlist_mode_email_idx" ON "formation_waitlist" USING btree ("mode","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "formation_waitlist_created_at_idx" ON "formation_waitlist" USING btree ("created_at");