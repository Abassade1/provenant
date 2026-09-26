import type { JobStatus, Polarity, SignalCode } from "./types";

/**
 * Plain-language catalog. The same text powers the Passport ("what we
 * checked", "what it means") and the public "How verification works" page, so
 * the explanation can never drift from the code.
 */
export interface SignalDefinition {
  code: SignalCode;
  polarity: Polarity | "POSITIVE_OR_NEUTRAL";
  weight: number;
  label: string;
  checked: string;
  meaning: string;
}

export const SIGNALS: Record<SignalCode, SignalDefinition> = {
  // Negative signals first (higher weight = shown first).
  UPFRONT_PAYMENT_REQUEST: {
    code: "UPFRONT_PAYMENT_REQUEST", polarity: "NEGATIVE", weight: 100,
    label: "Asks for money up front",
    checked: "We scanned the text for requests to pay fees, buy equipment, send crypto or gift cards, or deposit a cheque.",
    meaning: "Real employers don't ask applicants to pay to get or start a job. This is one of the most common job-scam patterns.",
  },
  OFF_PLATFORM_CONTACT: {
    code: "OFF_PLATFORM_CONTACT", polarity: "NEGATIVE", weight: 95,
    label: "Moves the conversation off-platform",
    checked: "We scanned the text for requests to continue on WhatsApp, Telegram, text message or a personal email address.",
    meaning: "Recruiters for real employers normally use company email and the employer's hiring system. Moving to a messaging app is a common scam pattern.",
  },
  LOOKALIKE_DOMAIN: {
    code: "LOOKALIKE_DOMAIN", polarity: "NEGATIVE", weight: 90,
    label: "Link imitates a known employer's website",
    checked: "We compared the link's domain with the domains of employers we know.",
    meaning: "The link is very close to, but not the same as, a real employer's domain. Lookalike domains are used to impersonate employers.",
  },
  APPLY_URL_MISMATCH: {
    code: "APPLY_URL_MISMATCH", polarity: "NEGATIVE", weight: 85,
    label: "Apply link goes somewhere unexpected",
    checked: "We compared the apply link's domain with the employer's own domains and well-known hiring systems.",
    meaning: "The application isn't hosted by the employer or a hiring system we recognize. It may still be legitimate. Check the employer's official site first.",
  },
  SALARY_CONFLICT: {
    code: "SALARY_CONFLICT", polarity: "NEGATIVE", weight: 70,
    label: "Sources disagree on salary",
    checked: "We compared employer-stated salary ranges across every source listing this job.",
    meaning: "Different listings show pay ranges that don't overlap. One of them may be outdated or wrong.",
  },
  USER_REPORTS: {
    code: "USER_REPORTS", polarity: "NEGATIVE", weight: 65,
    label: "Reported by several users",
    checked: "We counted separate users who reported this job and whose reports haven't been reviewed yet.",
    meaning: "Reports are waiting for staff review. They are not a finding on their own.",
  },
  NOT_FOUND_ON_EMPLOYER_SITE: {
    code: "NOT_FOUND_ON_EMPLOYER_SITE", polarity: "NEGATIVE", weight: 60,
    label: "Not on the employer's own job board",
    checked: "We checked the employer's own job board for this posting.",
    meaning: "We couldn't find it there. It may have closed, or it may not come from the employer. Contact the employer through their official website to confirm.",
  },
  STALE: {
    code: "STALE", polarity: "NEGATIVE", weight: 55,
    label: "Not confirmed recently",
    checked: "We looked at when this posting was last confirmed as listed.",
    meaning: "It hasn't been confirmed as listed in more than 14 days. It may be closed.",
  },
  // Positive / neutral
  ON_EMPLOYER_ATS: {
    code: "ON_EMPLOYER_ATS", polarity: "POSITIVE", weight: 50,
    label: "On the employer's own job board",
    checked: "We looked for this posting on the employer's own job board or careers page.",
    meaning: "The employer publishes this posting themselves.",
  },
  EMPLOYER_IDENTITY_CONFIRMED: {
    code: "EMPLOYER_IDENTITY_CONFIRMED", polarity: "POSITIVE", weight: 45,
    label: "Employer identity confirmed",
    checked: "We checked that the employer's own website links to the job board this posting comes from.",
    meaning: "The job board belongs to the employer named in the posting.",
  },
  RECENTLY_CONFIRMED_LIVE: {
    code: "RECENTLY_CONFIRMED_LIVE", polarity: "POSITIVE", weight: 40,
    label: "Confirmed listed in the last 72 hours",
    checked: "We rechecked the employer's board for this posting.",
    meaning: "The posting was still listed recently. We can confirm it is listed, not that the employer is actively hiring.",
  },
  APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS: {
    code: "APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", polarity: "POSITIVE", weight: 35,
    label: "Apply link goes to the employer or a known hiring system",
    checked: "We compared the apply link's domain with the employer's domains and well-known hiring systems.",
    meaning: "Applying sends your information to the employer's own site or a hiring system employers commonly use.",
  },
  SALARY_STATED_BY_EMPLOYER: {
    code: "SALARY_STATED_BY_EMPLOYER", polarity: "POSITIVE", weight: 30,
    label: "Salary stated by the employer",
    checked: "We looked for a pay range in the employer's own posting.",
    meaning: "The pay range comes from the employer, not an estimate.",
  },
  CONSISTENT_ACROSS_SOURCES: {
    code: "CONSISTENT_ACROSS_SOURCES", polarity: "POSITIVE", weight: 25,
    label: "Consistent across sources",
    checked: "We compared title, location and salary across every source listing this job.",
    meaning: "Every listing we found agrees.",
  },
  VACANCY_STATUS_DISCLOSED: {
    code: "VACANCY_STATUS_DISCLOSED", polarity: "POSITIVE_OR_NEUTRAL", weight: 20,
    label: "Vacancy status disclosed",
    checked: "We looked for a statement about whether this posting is for an existing vacancy.",
    meaning: "We quote the employer's statement as written. Many Ontario employers must include it since January 1, 2026. We don't judge compliance.",
  },
};

export interface StatusRule {
  id: string;
  status: JobStatus | "OVERRIDE";
  when: string;
}

/** Evaluated top to bottom; the first match wins. Mirrors status.ts exactly. */
export const STATUS_RULES: StatusRule[] = [
  { id: "R0", status: "OVERRIDE", when: "Provenant staff reviewed this job and set its status. We always show who reviewed it and when." },
  { id: "R1", status: "EXPIRED", when: "Every source we track has removed the posting." },
  { id: "R2", status: "HIGH_RISK", when: "Two or more job-scam patterns: asking for money, moving off-platform, a lookalike domain, or an unexpected apply link." },
  { id: "R3", status: "REVIEW_REQUIRED", when: "One scam pattern, three or more unreviewed user reports, conflicting salaries, or a possible duplicate awaiting review." },
  { id: "R4", status: "STALE", when: "Not confirmed as listed in more than 14 days." },
  { id: "R5", status: "VERIFIED", when: "On the employer's own job board, employer identity confirmed, confirmed listed in the last 72 hours, and no negative signals." },
  { id: "R6", status: "PARTIALLY_VERIFIED", when: "On the employer's own job board or employer identity confirmed, and no negative signals." },
  { id: "R7", status: "UNVERIFIED", when: "Anything else, including postings we couldn't find on the employer's own board. Unverified doesn't mean fake." },
];

export const SCAM_PATTERN_CODES: SignalCode[] = [
  "UPFRONT_PAYMENT_REQUEST",
  "OFF_PLATFORM_CONTACT",
  "LOOKALIKE_DOMAIN",
  "APPLY_URL_MISMATCH",
];

export const THRESHOLDS = {
  recentlyConfirmedHours: 72,
  staleDays: 14,
  mayBeClosedDays: 7,
  reportersForSignal: 3,
  salaryTolerance: 0.1,
} as const;

export const STATUS_LABELS: Record<JobStatus, string> = {
  VERIFIED: "Verified",
  PARTIALLY_VERIFIED: "Partially verified",
  UNVERIFIED: "Unverified",
  STALE: "Stale",
  EXPIRED: "Expired",
  REVIEW_REQUIRED: "Needs review",
  HIGH_RISK: "High risk",
};
