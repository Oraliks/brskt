CREATE TYPE "public"."promo_scope" AS ENUM('site', 'game', 'both');--> statement-breakpoint
CREATE TYPE "public"."vip_paid_access_status" AS ENUM('pending_payment', 'paid', 'active', 'ejected');--> statement-breakpoint
ALTER TYPE "public"."xp_event_reason" ADD VALUE 'vip_joined';--> statement-breakpoint
ALTER TYPE "public"."xp_event_reason" ADD VALUE 'vip_secured';--> statement-breakpoint
ALTER TYPE "public"."xp_event_reason" ADD VALUE 'formation_remote_completed';--> statement-breakpoint
ALTER TYPE "public"."xp_event_reason" ADD VALUE 'formation_onsite_completed';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anchoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"predictions" jsonb NOT NULL,
	"anchoring_index" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emotion_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"mood" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fomo_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"decisions" jsonb NOT NULL,
	"fomo_score" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_tap_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"taps" integer NOT NULL,
	"max_level" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loss_aversion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"choices" jsonb NOT NULL,
	"safe_count" integer NOT NULL,
	"coefficient" numeric(4, 2) NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patience_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"duration_held_ms" integer NOT NULL,
	"score" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pattern_memory_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"patterns_shown" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_paid_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"amount_eur" numeric(10, 2) NOT NULL,
	"payment_id" uuid,
	"status" "vip_paid_access_status" DEFAULT 'pending_payment' NOT NULL,
	"telegram_invite_link" text,
	"paid_at" timestamp,
	"activated_at" timestamp,
	"ejection_reason" text,
	"ejected_at" timestamp,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_resend_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "scope" "promo_scope" DEFAULT 'site' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_xp_states" ADD COLUMN "tap_upgrade_combo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_xp_states" ADD COLUMN "tap_upgrade_drain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_xp_states" ADD COLUMN "tap_upgrade_xp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_xp_states" ADD COLUMN "tap_challenge_done_date" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anchoring_runs" ADD CONSTRAINT "anchoring_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emotion_journal_entries" ADD CONSTRAINT "emotion_journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fomo_runs" ADD CONSTRAINT "fomo_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_tap_runs" ADD CONSTRAINT "game_tap_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loss_aversion_runs" ADD CONSTRAINT "loss_aversion_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patience_runs" ADD CONSTRAINT "patience_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pattern_memory_runs" ADD CONSTRAINT "pattern_memory_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vip_paid_accesses" ADD CONSTRAINT "vip_paid_accesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vip_paid_accesses" ADD CONSTRAINT "vip_paid_accesses_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anchoring_runs_user_idx" ON "anchoring_runs" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emotion_journal_user_idx" ON "emotion_journal_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emotion_journal_uniq_idx" ON "emotion_journal_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fomo_runs_user_idx" ON "fomo_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "game_tap_runs_user_idx" ON "game_tap_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loss_aversion_user_idx" ON "loss_aversion_runs" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patience_runs_user_idx" ON "patience_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pattern_memory_runs_user_idx" ON "pattern_memory_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_paid_accesses_user_idx" ON "vip_paid_accesses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_paid_accesses_status_idx" ON "vip_paid_accesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_paid_accesses_payment_idx" ON "vip_paid_accesses" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vip_paid_accesses_active_uniq" ON "vip_paid_accesses" USING btree ("user_id") WHERE status <> 'ejected';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_codes_scope_idx" ON "promo_codes" USING btree ("scope","active");