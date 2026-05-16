CREATE TYPE "public"."prediction_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."prediction_market" AS ENUM('nasdaq', 'dowjones', 'gold', 'wti', 'ger40');--> statement-breakpoint
CREATE TYPE "public"."wheel_reward_type" AS ENUM('xp', 'promo');--> statement-breakpoint
CREATE TYPE "public"."xp_event_reason" AS ENUM('prediction_made', 'prediction_correct', 'prediction_streak', 'wheel_spin', 'admin_adjustment');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_market_candles" (
	"market" "prediction_market" NOT NULL,
	"candle_date" date NOT NULL,
	"open_price" numeric(20, 8) NOT NULL,
	"close_price" numeric(20, 8),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"market" "prediction_market" NOT NULL,
	"prediction_date" date NOT NULL,
	"direction" "prediction_direction" NOT NULL,
	"open_price" numeric(20, 8),
	"close_price" numeric(20, 8),
	"resolved" boolean DEFAULT false NOT NULL,
	"correct" boolean,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_wheel_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_type" "wheel_reward_type" NOT NULL,
	"reward_value" text,
	"reward_label" text NOT NULL,
	"redeemed" boolean DEFAULT false NOT NULL,
	"redeemed_at" timestamp,
	"spun_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "xp_event_reason" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "xp_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prediction_streak_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prediction_streak_longest" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prediction_last_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_wheel_spun_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_predictions" ADD CONSTRAINT "game_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_wheel_spins" ADD CONSTRAINT "game_wheel_spins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_market_candles_pk" ON "game_market_candles" USING btree ("market","candle_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_predictions_user_idx" ON "game_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_predictions_date_idx" ON "game_predictions" USING btree ("prediction_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_predictions_uniq_idx" ON "game_predictions" USING btree ("user_id","market","prediction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_predictions_unresolved_idx" ON "game_predictions" USING btree ("prediction_date","resolved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_wheel_spins_user_idx" ON "game_wheel_spins" USING btree ("user_id","spun_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_events_user_idx" ON "xp_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_events_created_at_idx" ON "xp_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_events_user_created_idx" ON "xp_events" USING btree ("user_id","created_at");