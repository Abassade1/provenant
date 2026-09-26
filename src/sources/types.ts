import type { schema } from "@/db/client";

export type SourceType = (typeof schema.sourceType.enumValues)[number];

/** Static description of a source, persisted to the `source` table. */
export interface SourceDescriptor {
  /** Stable key, e.g. "greenhouse:acme". */
  key: string;
  type: SourceType;
  provider: string;
  name: string;
  boardToken?: string;
  /** Where the terms that permit our use are published. */
  termsReference: string;
  /** Plain-language summary of what those terms let us do. */
  allowedUse: string;
  rateLimitPerMin: number;
  isDemo: boolean;
  /** The employer's own board or careers page, as opposed to an aggregator. */
  employerOwned: boolean;
  /**
   * The employer this source belongs to, when the source is an employer's own
   * board. Phase 3 employer resolution uses it as the strongest hint.
   */
  employerHint?: EmployerHint;
}

export interface EmployerHint {
  name: string;
  domain?: string;
  /** Page on the employer's own domain that links to this board (identity evidence). */
  careersUrl?: string;
}

/** A posting exactly as the source returned it. Stored verbatim in raw_posting. */
export interface RawPosting {
  externalRef: string;
  payload: unknown;
}

export interface FetchPage {
  postings: RawPosting[];
  nextCursor: string | null;
}

export type LiveState = "LIVE" | "GONE" | "UNKNOWN";

export interface LiveStatus {
  state: LiveState;
  checkedAt: Date;
  evidenceUrl?: string;
  detail: string;
}

export interface SalaryHint {
  min?: number;
  max?: number;
  currency?: string;
  period?: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
  /** Literal text the salary came from, shown as evidence. */
  text: string;
}

/** Source-agnostic view of one posting, produced by `JobSource.parse`. */
export interface ParsedPosting {
  externalRef: string;
  title: string;
  employerName: string;
  locationText: string | null;
  employmentTypeText: string | null;
  workplaceTypeText: string | null;
  descriptionText: string;
  url: string;
  applyUrl: string | null;
  postedAt: Date | null;
  salary: SalaryHint | null;
  /** Skills the source lists explicitly (not inferred). */
  skills?: string[];
}

export interface JobSource {
  descriptor: SourceDescriptor;
  fetch(cursor: string | null): Promise<FetchPage>;
  parse(raw: RawPosting): ParsedPosting;
  checkLive(externalRef: string): Promise<LiveStatus>;
  /**
   * For employer-owned boards: check that a page on the employer's own domain
   * links to this board (the evidence behind identity CONFIRMED).
   */
  probeIdentity?(): Promise<IdentityProbe>;
}

export interface IdentityProbe {
  /** true = link found, false = page fetched but no link, null = couldn't check. */
  linked: boolean | null;
  checkedAt: Date;
  evidenceUrl?: string;
  detail: string;
}
