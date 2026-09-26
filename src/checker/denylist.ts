import { registrableDomain } from "@/verification/domains";

/**
 * Sites whose terms forbid scraping (brief §3). We never fetch these on the
 * user's behalf, even for a single job the user is asking us to check — that
 * would still be an automated fetch from our servers. We ask for pasted text
 * instead (§12.5, Checkpoint 1 decision).
 */
export const DISALLOWED_DOMAINS = [
  "linkedin.com",
  "indeed.com",
  "ca.indeed.com",
  "glassdoor.com",
  "glassdoor.ca",
  "ziprecruiter.com",
  "monster.com",
  "monster.ca",
  "facebook.com",
];

export function isDisallowedHost(host: string): boolean {
  return DISALLOWED_DOMAINS.includes(registrableDomain(host));
}
