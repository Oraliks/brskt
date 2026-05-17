CREATE TABLE IF NOT EXISTS "candle_hop_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"taps" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"is_personal_best" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candle_hop_runs" ADD CONSTRAINT "candle_hop_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candle_hop_runs_user_idx" ON "candle_hop_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candle_hop_runs_score_idx" ON "candle_hop_runs" USING btree ("score");