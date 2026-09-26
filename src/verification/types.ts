/**
 * Verification module types.
 *
 * GUARDRAIL (brief §7, §17): nothing in src/verification may import from
 * outside src/verification, and VerificationInput carries no plan, billing or
 * sponsorship fields. test/verification-isolation.test.ts enforces both.
 */

export type JobStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED"
  | "STALE"
  | "EXPIRED"
  | "REVIEW_REQUIRED"
  | "HIGH_RISK";

export type Polarity = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export type SignalCode =
  | "ON_EMPLOYER_ATS"
  | "EMPLOYER_IDENTITY_CONFIRMED"
  | "APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS"
  | "RECENTLY_CONFIRMED_LIVE"
  | "SALARY_STATED_BY_EMPLOYER"
  | "VACANCY_STATUS_DISCLOSED"
  | "CONSISTENT_ACROSS_SOURCES"
  | "NOT_FOUND_ON_EMPLOYER_SITE"
  | "APPLY_URL_MISMATCH"
  | "LOOKALIKE_DOMAIN"
  | "OFF_PLATFORM_CONTACT"
  | "UPFRONT_PAYMENT_REQUEST"
  | "SALARY_CONFLICT"
  | "STALE"
  | "USER_REPORTS";

export interface Signal {
  code: SignalCode;
  polarity: Polarity;
  /** Display order only. Never summed, never shown. */
  weight: number;
  /** What we found, specific to this job. Quotes are literal. */
  evidenceText: string;
  evidenceUrl?: string;
  observedAt: Date;
  sourceId?: string;
}

export type IdentityStatus = "CONFIRMED" | "PROBABLE" | "UNKNOWN";
export type SalaryPeriod = "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface SourceRecordInput {
  sourceId: string;
  sourceName: string;
  /** The employer's own board or careers page (ATS board, career page, demo board). */
  employerOwned: boolean;
  url: string;
  applyUrl: string | null;
  titleStem: string;
  /** "toronto|ON|HYBRID"-style key for consistency checks. */
  locationKey: string;
  lastVerifiedAt: Date | null;
  expiredAt: Date | null;
}

export interface SalaryInput {
  sourceId: string | null;
  type: "EMPLOYER_STATED" | "GOVERNMENT_DATA" | "COLLECTIVE_AGREEMENT" | "MARKET_COMPARABLE" | "PLATFORM_ESTIMATE" | "UNKNOWN";
  min: number | null;
  max: number | null;
  period: SalaryPeriod | null;
  currency: string;
  employerHosted: boolean;
  evidenceText: string;
}

export interface VerificationInput {
  now: Date;
  job: {
    applyUrl: string | null;
    /** All text we can scan for patterns: description, or the user's pasted text in Check a Job. */
    text: string;
    vacancyStatement: string | null;
    firstSeenAt: Date;
    lastVerifiedAt: Date | null;
    expiredAt: Date | null;
  };
  employer: {
    name: string;
    identityStatus: IdentityStatus;
    identityEvidence: { text: string; url?: string; observedAt: string }[];
    /** Domains the employer is known to own (primary + careers). */
    domains: string[];
    /** The employer has an employer-owned board we ingest. */
    hasEmployerBoard: boolean;
    /** When that board was last fetched successfully. */
    employerBoardCheckedAt: Date | null;
  } | null;
  sources: SourceRecordInput[];
  salaries: SalaryInput[];
  /** Distinct users with a pending report on this job. */
  pendingReporters: number;
  openDuplicateCluster: boolean;
  override: { status: JobStatus; at: Date; note: string | null } | null;
  /** Primary domains of all known employers (for lookalike detection). */
  knownEmployerDomains: string[];
}

export interface VerificationResult {
  signals: Signal[];
  status: JobStatus;
  ruleId: string;
}
