CREATE TYPE "public"."price_alert_direction" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TYPE "public"."price_alert_source" AS ENUM('fx', 'crypto');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"source" "price_alert_source" NOT NULL,
	"threshold" numeric(20, 8) NOT NULL,
	"direction" "price_alert_direction" NOT NULL,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_alerts_user_id_idx" ON "price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_alerts_symbol_idx" ON "price_alerts" USING btree ("symbol","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_alerts_triggered_idx" ON "price_alerts" USING btree ("triggered_at");