CREATE TYPE "public"."analytics_event_name" AS ENUM('check_submitted', 'passport_expanded', 'search_performed', 'apply_clicked', 'job_saved', 'alert_created', 'report_submitted');--> statement-breakpoint
CREATE TABLE "analytics_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "analytics_event_name" NOT NULL,
	"user_id" uuid,
	"session_id" text,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_event_name_idx" ON "analytics_event" USING btree ("name","created_at");