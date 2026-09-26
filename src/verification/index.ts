import { computeSignals } from "./signals";
import { deriveStatus } from "./status";
import type { VerificationInput, VerificationResult } from "./types";

export * from "./types";
export { SIGNALS, STATUS_RULES, STATUS_LABELS, THRESHOLDS, SCAM_PATTERN_CODES } from "./catalog";
export { findOffPlatformContact, findUpfrontPayment } from "./patterns";
export { hostnameOf, registrableDomain, isKnownAts, lookalikeOf } from "./domains";
export { annualRange, salariesConflict } from "./signals";

/** Pure: same input → same signals and status. No I/O. */
export function verify(input: VerificationInput): VerificationResult {
  const signals = computeSignals(input);
  const { status, ruleId } = deriveStatus(signals, input);
  return { signals, status, ruleId };
}
