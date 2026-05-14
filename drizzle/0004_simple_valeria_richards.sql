CREATE TYPE "public"."payment_plan" AS ENUM('full', 'installments_3x');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_plan" "payment_plan" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installment_total" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installments_paid" integer DEFAULT 0 NOT NULL;