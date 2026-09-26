CREATE TYPE "public"."check_status" AS ENUM('PENDING', 'COMPLETE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."cluster_status" AS ENUM('AUTO_MERGED', 'REVIEW_REQUIRED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."domain_kind" AS ENUM('PRIMARY', 'CAREERS', 'ATS_BOARD');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'SEASONAL', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."identity_status" AS ENUM('CONFIRMED', 'PROBABLE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'STALE', 'EXPIRED', 'REVIEW_REQUIRED', 'HIGH_RISK');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('FETCH', 'PARSE', 'NORMALIZE', 'VALIDATE', 'RESOLVE_EMPLOYER', 'DEDUPLICATE', 'EXTRACT_SALARY', 'VERIFY', 'UPSERT', 'INDEX');--> statement-breakpoint
CREATE TYPE "public"."remote_type" AS ENUM('ONSITE', 'HYBRID', 'REMOTE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('PENDING', 'UPHELD', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "public"."salary_type" AS ENUM('EMPLOYER_STATED', 'GOVERNMENT_DATA', 'COLLECTIVE_AGREEMENT', 'MARKET_COMPARABLE', 'PLATFORM_ESTIMATE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."signal_polarity" AS ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL');--> statement-breakpoint
CREATE TYPE "public"."signal_subject" AS ENUM('JOB', 'CHECK');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('ATS_PUBLIC_BOARD', 'EMPLOYER_CAREER_PAGE', 'GOVERNMENT_OPEN_DATA', 'LICENSED_FEED', 'EMPLOYER_SUBMITTED', 'USER_SUBMITTED_CHECK', 'DEMO');--> statement-breakpoint
CREATE TYPE "public"."user_plan" AS ENUM('FREE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_normalized" text NOT NULL,
	"title_stem" text NOT NULL,
	"city" text,
	"province" text,
	"country" text DEFAULT 'CA' NOT NULL,
	"remote_type" "remote_type" DEFAULT 'UNKNOWN' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'UNKNOWN' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"apply_url" text NOT NULL,
	"vacancy_statement" text,
	"status" "job_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"search_tsv" "tsvector",
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_cluster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "cluster_status" NOT NULL,
	"score" numeric(5, 4),
	"features" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"primary_domain" text,
	"identity_status" "identity_status" DEFAULT 'UNKNOWN' NOT NULL,
	"identity_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"registry_ref" text,
	"locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_normalized" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"kind" "domain_kind" NOT NULL,
	"verified_at" timestamp with time zone,
	"evidence_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_error" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"stage" "pipeline_stage" NOT NULL,
	"payload_ref" text,
	"message" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"dead_lettered_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"upserted" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"errored" integer DEFAULT 0 NOT NULL,
	"cursor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" text,
	"input_url" text,
	"input_text_encrypted" text,
	"extracted" jsonb,
	"matched_canonical_job_id" uuid,
	"status" "check_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"canonical_job_id" uuid,
	"job_check_id" uuid,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_source_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"raw_posting_id" uuid,
	"external_ref" text NOT NULL,
	"url" text NOT NULL,
	"apply_url" text,
	"title" text NOT NULL,
	"location_text" text,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"duplicate_cluster_id" uuid,
	"match_score" numeric(5, 4),
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_posting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_ref" text NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"source_id" uuid,
	"min" numeric(12, 2),
	"max" numeric(12, 2),
	"currency" text DEFAULT 'CAD' NOT NULL,
	"period" "salary_period",
	"type" "salary_type" NOT NULL,
	"evidence_text" text NOT NULL,
	"derived" boolean DEFAULT false NOT NULL,
	"model" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"type" "source_type" NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"board_token" text,
	"terms_reference" text NOT NULL,
	"allowed_use" text NOT NULL,
	"rate_limit_per_min" integer DEFAULT 30 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"plan" "user_plan" DEFAULT 'FREE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" text,
	"city" text,
	"province" text,
	"desired_titles" text[],
	"skills" text[],
	"min_salary" integer,
	"remote_preference" "remote_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "signal_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"code" text NOT NULL,
	"polarity" "signal_polarity" NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	"evidence_text" text NOT NULL,
	"evidence_url" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid,
	"superseded_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"from_status" "job_status",
	"to_status" "job_status" NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_job" ADD CONSTRAINT "canonical_job_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_alias" ADD CONSTRAINT "employer_alias_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_domain" ADD CONSTRAINT "employer_domain_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_error" ADD CONSTRAINT "ingestion_error_run_id_ingestion_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_error" ADD CONSTRAINT "ingestion_error_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_run" ADD CONSTRAINT "ingestion_run_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_check" ADD CONSTRAINT "job_check_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_check" ADD CONSTRAINT "job_check_matched_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("matched_canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_report" ADD CONSTRAINT "job_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_report" ADD CONSTRAINT "job_report_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_report" ADD CONSTRAINT "job_report_job_check_id_job_check_id_fk" FOREIGN KEY ("job_check_id") REFERENCES "public"."job_check"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_record" ADD CONSTRAINT "job_source_record_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_record" ADD CONSTRAINT "job_source_record_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_record" ADD CONSTRAINT "job_source_record_raw_posting_id_raw_posting_id_fk" FOREIGN KEY ("raw_posting_id") REFERENCES "public"."raw_posting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_record" ADD CONSTRAINT "job_source_record_duplicate_cluster_id_duplicate_cluster_id_fk" FOREIGN KEY ("duplicate_cluster_id") REFERENCES "public"."duplicate_cluster"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_posting" ADD CONSTRAINT "raw_posting_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_evidence" ADD CONSTRAINT "salary_evidence_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_evidence" ADD CONSTRAINT "salary_evidence_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_job" ADD CONSTRAINT "saved_job_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_signal" ADD CONSTRAINT "verification_signal_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_status_history" ADD CONSTRAINT "verification_status_history_canonical_job_id_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canonical_job_block_idx" ON "canonical_job" USING btree ("employer_id","title_stem","city","remote_type");--> statement-breakpoint
CREATE INDEX "canonical_job_status_idx" ON "canonical_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "canonical_job_search_idx" ON "canonical_job" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "canonical_job_title_trgm_idx" ON "canonical_job" USING gin ("title_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "employer_slug_uq" ON "employer" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "employer_alias_uq" ON "employer_alias" USING btree ("employer_id","alias_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "employer_domain_uq" ON "employer_domain" USING btree ("employer_id","domain","kind");--> statement-breakpoint
CREATE INDEX "ingestion_error_open_idx" ON "ingestion_error" USING btree ("dead_lettered_at","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_record_uq" ON "job_source_record" USING btree ("source_id","external_ref");--> statement-breakpoint
CREATE INDEX "job_source_record_job_idx" ON "job_source_record" USING btree ("canonical_job_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_posting_uq" ON "raw_posting" USING btree ("source_id","external_ref","content_hash");--> statement-breakpoint
CREATE INDEX "salary_evidence_job_idx" ON "salary_evidence" USING btree ("canonical_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_job_uq" ON "saved_job" USING btree ("user_id","canonical_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_key_uq" ON "source" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_signal_subject_idx" ON "verification_signal" USING btree ("subject_type","subject_id","superseded_at");