DO $$ BEGIN
 CREATE TYPE "public"."offline_coaching_status" AS ENUM('active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offline_coachings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"mode" text DEFAULT 'remote' NOT NULL,
	"total_amount_eur" numeric(10, 2) NOT NULL,
	"paid_amount_eur" numeric(10, 2) DEFAULT '0' NOT NULL,
	"scheduled_date" date,
	"notes" text,
	"status" "offline_coaching_status" DEFAULT 'active' NOT NULL,
	"linked_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offline_coachings" ADD CONSTRAINT "offline_coachings_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offline_coachings_status_idx" ON "offline_coachings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offline_coachings_scheduled_idx" ON "offline_coachings" USING btree ("scheduled_date");