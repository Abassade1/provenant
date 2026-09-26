import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const isDemo = () => boolean("is_demo").notNull().default(false);

// ── Enums ────────────────────────────────────────────────────────────────────

export const sourceType = pgEnum("source_type", [
  "ATS_PUBLIC_BOARD",
  "EMPLOYER_CAREER_PAGE",
  "GOVERNMENT_OPEN_DATA",
  "LICENSED_FEED",
  "EMPLOYER_SUBMITTED",
  "USER_SUBMITTED_CHECK",
  "DEMO",
]);
export const runStatus = pgEnum("run_status", ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"]);
export const pipelineStage = pgEnum("pipeline_stage", [
  "FETCH",
  "PARSE",
  "NORMALIZE",
  "VALIDATE",
  "RESOLVE_EMPLOYER",
  "DEDUPLICATE",
  "EXTRACT_SALARY",
  "VERIFY",
  "UPSERT",
  "INDEX",
]);
export const identityStatus = pgEnum("identity_status", ["CONFIRMED", "PROBABLE", "UNKNOWN"]);
export const domainKind = pgEnum("domain_kind", ["PRIMARY", "CAREERS", "ATS_BOARD"]);
export const remoteType = pgEnum("remote_type", ["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"]);
export const employmentType = pgEnum("employment_type", [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "SEASONAL",
  "UNKNOWN",
]);
export const jobStatus = pgEnum("job_status", [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "UNVERIFIED",
  "STALE",
  "EXPIRED",
  "REVIEW_REQUIRED",
  "HIGH_RISK",
]);
export const salaryType = pgEnum("salary_type", [
  "EMPLOYER_STATED",
  "GOVERNMENT_DATA",
  "COLLECTIVE_AGREEMENT",
  "MARKET_COMPARABLE",
  "PLATFORM_ESTIMATE",
  "UNKNOWN",
]);
export const salaryPeriod = pgEnum("salary_period", ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]);
export const signalPolarity = pgEnum("signal_polarity", ["POSITIVE", "NEGATIVE", "NEUTRAL"]);
export const signalSubject = pgEnum("signal_subject", ["JOB", "CHECK"]);
export const clusterStatus = pgEnum("cluster_status", ["AUTO_MERGED", "REVIEW_REQUIRED", "RESOLVED"]);
export const userRole = pgEnum("user_role", ["USER", "ADMIN"]);
export const userPlan = pgEnum("user_plan", ["FREE"]);
export const reportStatus = pgEnum("report_status", ["PENDING", "UPHELD", "DISMISSED"]);
export const checkStatus = pgEnum("check_status", ["PENDING", "COMPLETE", "FAILED"]);

// ── Sources & ingestion ─────────────────────────────────────────────────────

export const source = pgTable(
  "source",
  {
    id: id(),
    key: text("key").notNull(), // stable identifier, e.g. "greenhouse:acme"
    type: sourceType("type").notNull(),
    provider: text("provider").notNull(), // greenhouse | lever | ashby | jobbank | demo
    name: text("name").notNull(),
    boardToken: text("board_token"),
    termsReference: text("terms_reference").notNull(), // WHY we may use it
    allowedUse: text("allowed_use").notNull(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(30),
    enabled: boolean("enabled").notNull().default(true),
    lastSuccessAt: ts("last_success_at"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [uniqueIndex("source_key_uq").on(t.key)],
);

export const ingestionRun = pgTable("ingestion_run", {
  id: id(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => source.id, { onDelete: "cascade" }),
  status: runStatus("status").notNull().default("RUNNING"),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  fetched: integer("fetched").notNull().default(0),
  upserted: integer("upserted").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  errored: integer("errored").notNull().default(0),
  cursor: text("cursor"),
  ...timestamps,
});

export const ingestionError = pgTable(
  "ingestion_error",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => ingestionRun.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    stage: pipelineStage("stage").notNull(),
    payloadRef: text("payload_ref"), // raw_posting id or external ref — never raw content
    message: text("message").notNull(),
    retryCount: integer("retry_count").notNull().default(0), // retries already attempted before this failure (0..3)
    deadLetteredAt: ts("dead_lettered_at"),
    resolvedAt: ts("resolved_at"),
    ...timestamps,
  },
  (t) => [index("ingestion_error_open_idx").on(t.deadLetteredAt, t.resolvedAt)],
);

export const rawPosting = pgTable(
  "raw_posting",
  {
    id: id(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    externalRef: text("external_ref").notNull(),
    payload: jsonb("payload").notNull(),
    contentHash: text("content_hash").notNull(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [uniqueIndex("raw_posting_uq").on(t.sourceId, t.externalRef, t.contentHash)],
);

// ── Employers ───────────────────────────────────────────────────────────────

export const employer = pgTable(
  "employer",
  {
    id: id(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    primaryDomain: text("primary_domain"),
    identityStatus: identityStatus("identity_status").notNull().default("UNKNOWN"),
    identityEvidence: jsonb("identity_evidence").$type<IdentityEvidence[]>().notNull().default([]),
    registryRef: text("registry_ref"), // P1 — business registry; never faked
    locations: text("locations").array().notNull().default(sql`'{}'::text[]`),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [uniqueIndex("employer_slug_uq").on(t.slug)],
);

export type IdentityEvidence = {
  kind: string;
  text: string;
  url?: string;
  observedAt: string;
};

export const employerAlias = pgTable(
  "employer_alias",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employer.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    aliasNormalized: text("alias_normalized").notNull(),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [uniqueIndex("employer_alias_uq").on(t.employerId, t.aliasNormalized)],
);

export const employerDomain = pgTable(
  "employer_domain",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employer.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    kind: domainKind("kind").notNull(),
    verifiedAt: ts("verified_at"),
    evidenceUrl: text("evidence_url"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [uniqueIndex("employer_domain_uq").on(t.employerId, t.domain, t.kind)],
);

// ── Jobs ────────────────────────────────────────────────────────────────────

export const duplicateCluster = pgTable("duplicate_cluster", {
  id: id(),
  status: clusterStatus("status").notNull(),
  score: numeric("score", { precision: 5, scale: 4 }),
  features: jsonb("features"),
  isDemo: isDemo(),
  ...timestamps,
});

export const canonicalJob = pgTable(
  "canonical_job",
  {
    id: id(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employer.id),
    title: text("title").notNull(),
    titleNormalized: text("title_normalized").notNull(),
    titleStem: text("title_stem").notNull(),
    city: text("city"),
    province: text("province"), // 2-letter code
    country: text("country").notNull().default("CA"),
    remoteType: remoteType("remote_type").notNull().default("UNKNOWN"),
    employmentType: employmentType("employment_type").notNull().default("UNKNOWN"),
    description: text("description").notNull().default(""),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    applyUrl: text("apply_url").notNull(),
    vacancyStatement: text("vacancy_statement"),
    status: jobStatus("status").notNull().default("UNVERIFIED"),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    lastVerifiedAt: ts("last_verified_at"),
    expiredAt: ts("expired_at"),
    searchTsv: tsvector("search_tsv"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [
    index("canonical_job_block_idx").on(t.employerId, t.titleStem, t.city, t.remoteType),
    index("canonical_job_status_idx").on(t.status),
    index("canonical_job_search_idx").using("gin", t.searchTsv),
    index("canonical_job_title_trgm_idx").using("gin", sql`${t.titleNormalized} gin_trgm_ops`),
  ],
);

export const jobSourceRecord = pgTable(
  "job_source_record",
  {
    id: id(),
    canonicalJobId: uuid("canonical_job_id")
      .notNull()
      .references(() => canonicalJob.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id),
    rawPostingId: uuid("raw_posting_id").references(() => rawPosting.id, { onDelete: "set null" }),
    externalRef: text("external_ref").notNull(),
    url: text("url").notNull(),
    applyUrl: text("apply_url"),
    title: text("title").notNull(),
    locationText: text("location_text"),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    lastVerifiedAt: ts("last_verified_at"),
    expiredAt: ts("expired_at"),
    duplicateClusterId: uuid("duplicate_cluster_id").references(() => duplicateCluster.id, {
      onDelete: "set null",
    }),
    matchScore: numeric("match_score", { precision: 5, scale: 4 }),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("job_source_record_uq").on(t.sourceId, t.externalRef),
    index("job_source_record_job_idx").on(t.canonicalJobId),
  ],
);

export const salaryEvidence = pgTable(
  "salary_evidence",
  {
    id: id(),
    canonicalJobId: uuid("canonical_job_id")
      .notNull()
      .references(() => canonicalJob.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => source.id),
    min: numeric("min", { precision: 12, scale: 2 }),
    max: numeric("max", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("CAD"),
    period: salaryPeriod("period"),
    type: salaryType("type").notNull(),
    evidenceText: text("evidence_text").notNull(),
    derived: boolean("derived").notNull().default(false), // true when produced by an AI enrichment
    model: text("model"),
    observedAt: ts("observed_at").notNull().defaultNow(),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [index("salary_evidence_job_idx").on(t.canonicalJobId)],
);

export const verificationSignal = pgTable(
  "verification_signal",
  {
    id: id(),
    subjectType: signalSubject("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    code: text("code").notNull(),
    polarity: signalPolarity("polarity").notNull(),
    weight: integer("weight").notNull().default(0), // UI ordering only; never summed
    evidenceText: text("evidence_text").notNull(),
    evidenceUrl: text("evidence_url"),
    observedAt: ts("observed_at").notNull().defaultNow(),
    sourceId: uuid("source_id").references(() => source.id),
    supersededAt: ts("superseded_at"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [index("verification_signal_subject_idx").on(t.subjectType, t.subjectId, t.supersededAt)],
);

export const verificationStatusHistory = pgTable("verification_status_history", {
  id: id(),
  canonicalJobId: uuid("canonical_job_id")
    .notNull()
    .references(() => canonicalJob.id, { onDelete: "cascade" }),
  fromStatus: jobStatus("from_status"),
  toStatus: jobStatus("to_status").notNull(),
  reason: text("reason").notNull(), // rule id (R0..R7) or ADMIN_OVERRIDE
  actorUserId: uuid("actor_user_id"),
  isDemo: isDemo(),
  ...timestamps,
});

// ── Users ───────────────────────────────────────────────────────────────────

export const user = pgTable(
  "user",
  {
    id: id(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name"),
    role: userRole("role").notNull().default("USER"),
    // Monetization field. Must never be read by src/verification (enforced by test).
    plan: userPlan("plan").notNull().default("FREE"),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_email_uq").on(t.email)],
);

export const userProfile = pgTable("user_profile", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text("headline"),
  city: text("city"),
  province: text("province"),
  desiredTitles: text("desired_titles").array(),
  skills: text("skills").array(),
  minSalary: integer("min_salary"),
  remotePreference: remoteType("remote_preference"),
  ...timestamps,
});

export const savedJob = pgTable(
  "saved_job",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    canonicalJobId: uuid("canonical_job_id")
      .notNull()
      .references(() => canonicalJob.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("saved_job_uq").on(t.userId, t.canonicalJobId)],
);

export const savedSearch = pgTable("saved_search", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  lastNotifiedAt: ts("last_notified_at"),
  ...timestamps,
});

export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    readAt: ts("read_at"),
    ...timestamps,
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt)],
);

export const jobCheck = pgTable("job_check", {
  id: id(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  inputUrl: text("input_url"),
  inputTextEncrypted: text("input_text_encrypted"),
  extracted: jsonb("extracted"),
  matchedCanonicalJobId: uuid("matched_canonical_job_id").references(() => canonicalJob.id, {
    onDelete: "set null",
  }),
  status: checkStatus("status").notNull().default("PENDING"),
  expiresAt: ts("expires_at").notNull(),
  ...timestamps,
});

export const jobReport = pgTable("job_report", {
  id: id(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  canonicalJobId: uuid("canonical_job_id").references(() => canonicalJob.id, { onDelete: "cascade" }),
  jobCheckId: uuid("job_check_id").references(() => jobCheck.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatus("status").notNull().default("PENDING"),
  ...timestamps,
});

export const adminAuditLog = pgTable("admin_audit_log", {
  id: id(),
  actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ...timestamps,
});
