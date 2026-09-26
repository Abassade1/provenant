import { SCAM_PATTERN_CODES } from "./catalog";
import type { JobStatus, Signal, VerificationInput } from "./types";

/** Implements STATUS_RULES (catalog.ts). First match wins. */
export function deriveStatus(signals: Signal[], input: VerificationInput): { status: JobStatus; ruleId: string } {
  const has = (code: Signal["code"]) => signals.some((s) => s.code === code);
  const negatives = signals.filter((s) => s.polarity === "NEGATIVE");
  const scamPatterns = signals.filter((s) => SCAM_PATTERN_CODES.includes(s.code));

  if (input.override) return { status: input.override.status, ruleId: "R0" };

  const allSourcesGone = input.sources.length > 0 && input.sources.every((s) => s.expiredAt);
  if (input.job.expiredAt || allSourcesGone) return { status: "EXPIRED", ruleId: "R1" };

  if (scamPatterns.length >= 2) return { status: "HIGH_RISK", ruleId: "R2" };

  if (scamPatterns.length === 1 || has("USER_REPORTS") || has("SALARY_CONFLICT") || input.openDuplicateCluster) {
    return { status: "REVIEW_REQUIRED", ruleId: "R3" };
  }

  if (has("STALE")) return { status: "STALE", ruleId: "R4" };

  if (negatives.length === 0 && has("ON_EMPLOYER_ATS") && has("EMPLOYER_IDENTITY_CONFIRMED") && has("RECENTLY_CONFIRMED_LIVE")) {
    return { status: "VERIFIED", ruleId: "R5" };
  }

  if (negatives.length === 0 && (has("ON_EMPLOYER_ATS") || has("EMPLOYER_IDENTITY_CONFIRMED"))) {
    return { status: "PARTIALLY_VERIFIED", ruleId: "R6" };
  }

  return { status: "UNVERIFIED", ruleId: "R7" };
}
