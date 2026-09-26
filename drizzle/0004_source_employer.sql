ALTER TABLE "source" ADD COLUMN "employer_owned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "employer_id" uuid;