CREATE TYPE "public"."quiz_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text,
	"difficulty" "quiz_difficulty" DEFAULT 'medium' NOT NULL,
	"category" text,
	"sent_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"chosen_index" integer NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_questions_sent_at_idx" ON "quiz_questions" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_questions_active_idx" ON "quiz_questions" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_responses_user_id_idx" ON "quiz_responses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_responses_uniq_idx" ON "quiz_responses" USING btree ("user_id","question_id");