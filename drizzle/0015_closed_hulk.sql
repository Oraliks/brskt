CREATE TABLE IF NOT EXISTS "booking_automation_state" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"payment_nudge_count" integer DEFAULT 0 NOT NULL,
	"payment_nudge_at" timestamp,
	"formation_reminders_sent" integer DEFAULT 0 NOT NULL,
	"nps_asked_at" timestamp,
	"nps_score" integer,
	"nps_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_automation_state" ADD CONSTRAINT "booking_automation_state_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_auto_payment_nudge_idx" ON "booking_automation_state" USING btree ("payment_nudge_count");