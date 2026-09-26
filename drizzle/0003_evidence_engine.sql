ALTER TABLE "canonical_job" ADD COLUMN "vacancy_statement_derived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "status_rule" text;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "override_status" "job_status";--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "override_note" text;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "override_by" uuid;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD COLUMN "override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employer" ADD COLUMN "identity_checked_at" timestamp with time zone;