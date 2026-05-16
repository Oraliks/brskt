CREATE TABLE IF NOT EXISTS "user_xp_states" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"prediction_streak_count" integer DEFAULT 0 NOT NULL,
	"prediction_streak_longest" integer DEFAULT 0 NOT NULL,
	"prediction_last_date" date,
	"last_wheel_spun_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_xp_states" ADD CONSTRAINT "user_xp_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_xp_states_xp_idx" ON "user_xp_states" USING btree ("xp_total");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "xp_total";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "prediction_streak_count";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "prediction_streak_longest";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "prediction_last_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_wheel_spun_at";