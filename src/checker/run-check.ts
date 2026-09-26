import type { DB } from "@/db/client";
import { extractFromText } from "./parse";
import { fetchPostingText, type FetchOutcome } from "./fetch-posting";
import { findEmployer, findMatchingJob, type DisplaySalary, type DisplaySource } from "./match";
import { knownDomains } from "@/evidence/verify-job";
import { verify, type VerificationInput, type VerificationResult } from "@/verification";
import type { SalaryHint } from "@/sources/types";

export interface CheckInput {
  url: string | null;
  text: string | null;
  employerHint: string | null;
}

export interface CheckOutcome {
  ok: boolean;
  /** Why we couldn't produce a result at all (disallowed host, no input, etc). */
  blockedReason: string | null;
  usedFetchedText: boolean;
  fetchNote: string | null;
  extracted: {
    title: string | null;
    employerName: string | null;
    location: string | null;
    applyUrl: string | null;
    salary: SalaryHint | null;
    vacancyStatement: string | null;
  };
  matchedCanonicalJobId: string | null;
  matchedApplyUrl: string | null;
  employerIdentityStatus: "CONFIRMED" | "PROBABLE" | "UNKNOWN" | null;
  employerDomain: string | null;
  /**
   * The matched job's own sources/salary, for display — populated only on a
   * strong match, so the Passport can show real evidence instead of
   * re-describing the user's own pasted text as if it were that evidence.
   */
  matchedSources: DisplaySource[];
  matchedSalaries: DisplaySalary[];
  verification: VerificationResult | null;
  /** For the private job_check row — never logged. */
  rawTextForStorage: string | null;
}

/**
 * The Check a Job pipeline: parse -> resolve employer -> match against our
 * index (standing in for "look on their ATS/careers page") -> verify with
 * the same rule engine everything else uses.
 */
export async function runCheck(db: DB, input: CheckInput): Promise<CheckOutcome> {
  let text = input.text?.trim() || "";
  let usedFetchedText = false;
  let fetchNote: string | null = null;

  if (input.url) {
    const fetched: FetchOutcome = await fetchPostingText(input.url);
    if (fetched.ok) {
      text = [text, fetched.text].filter(Boolean).join("\n\n");
      usedFetchedText = true;
    } else {
      fetchNote = fetched.detail;
      if (fetched.reason === "DISALLOWED_HOST" && !text) {
        return {
          ok: false,
          blockedReason: fetched.detail,
          usedFetchedText: false,
          fetchNote,
          extracted: { title: null, employerName: null, location: null, applyUrl: null, salary: null, vacancyStatement: null },
          matchedCanonicalJobId: null,
          matchedApplyUrl: null,
          employerIdentityStatus: null,
          employerDomain: null,
          matchedSources: [],
          matchedSalaries: [],
          verification: null,
          rawTextForStorage: null,
        };
      }
      // Any other fetch failure: fall back to whatever text the user pasted, and say so.
    }
  }
  if (!text) {
    return {
      ok: false,
      blockedReason: "Paste the job posting, message, or email text, or a URL we can read.",
      usedFetchedText: false,
      fetchNote,
      extracted: { title: null, employerName: null, location: null, applyUrl: null, salary: null, vacancyStatement: null },
      matchedCanonicalJobId: null,
      matchedApplyUrl: null,
      employerIdentityStatus: null,
      employerDomain: null,
      matchedSources: [],
      matchedSalaries: [],
      verification: null,
      rawTextForStorage: null,
    };
  }

  const extracted = extractFromText(text, input.employerHint ?? undefined);
  const applyUrl = extracted.applyUrl ?? input.url ?? null;

  const employer = extracted.employerName ? await findEmployer(db, extracted.employerName) : null;
  const salaryFeature = extracted.salary
    ? { min: extracted.salary.min ?? null, max: extracted.salary.max ?? null, period: extracted.salary.period ?? null, currency: extracted.salary.currency ?? "CAD" }
    : null;
  const match = employer && extracted.title ? await findMatchingJob(db, employer.id, extracted.title, extracted.location, text, salaryFeature) : null;
  const domains = await knownDomains(db);

  const now = new Date();
  const verificationInput: VerificationInput = {
    now,
    job: {
      applyUrl,
      text,
      vacancyStatement: extracted.vacancyStatement,
      firstSeenAt: now,
      lastVerifiedAt: match?.isStrongMatch ? match.lastVerifiedAt : null,
      expiredAt: null,
    },
    employer: employer
      ? {
          name: employer.name,
          identityStatus: employer.identityStatus,
          identityEvidence: [],
          domains: employer.domains,
          hasEmployerBoard: !!match,
          employerBoardCheckedAt: match?.isStrongMatch ? match.lastVerifiedAt : null,
        }
      : null,
    // Only lend the indexed job's own source records (and their freshness) when we're
    // confident it's the same posting — otherwise we'd inherit trust it hasn't earned.
    sources: match?.isStrongMatch ? match.sources : [],
    salaries: extracted.salary
      ? [
          {
            sourceId: null,
            type: "EMPLOYER_STATED",
            min: extracted.salary.min ?? null,
            max: extracted.salary.max ?? null,
            period: extracted.salary.period ?? null,
            currency: extracted.salary.currency ?? "CAD",
            // Only "employer-hosted" when a strong match confirms the same posting said the same thing.
            employerHosted: !!match?.isStrongMatch,
            evidenceText: extracted.salary.text,
          },
        ]
      : [],
    pendingReporters: 0,
    openDuplicateCluster: false,
    override: null,
    knownEmployerDomains: domains,
  };

  const verification = verify(verificationInput);

  return {
    ok: true,
    blockedReason: null,
    usedFetchedText,
    fetchNote,
    extracted: {
      title: extracted.title,
      employerName: extracted.employerName,
      location: extracted.location,
      applyUrl,
      salary: extracted.salary,
      vacancyStatement: extracted.vacancyStatement,
    },
    matchedCanonicalJobId: match?.isStrongMatch ? match.canonicalJobId : null,
    matchedApplyUrl: match?.isStrongMatch ? (match.sources.find((s) => s.employerOwned)?.applyUrl ?? null) : null,
    employerIdentityStatus: employer?.identityStatus ?? null,
    employerDomain: employer?.domains[0] ?? null,
    matchedSources: match?.isStrongMatch ? match.displaySources : [],
    matchedSalaries: match?.isStrongMatch ? match.displaySalaries : [],
    verification,
    rawTextForStorage: text,
  };
}
