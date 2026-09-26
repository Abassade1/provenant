import { politeFetch, type FetchLike } from "@/lib/http";
import { registrableDomain as registrable } from "@/verification/domains";
import type { EmployerHint, IdentityProbe } from "./types";

/**
 * Fetch the employer's careers page (which must be on the employer's own
 * domain) and look for a link to the board. `boardPatterns` are the URL forms
 * that identify this specific board, e.g. "boards.greenhouse.io/acme".
 */
export async function probeCareersPageLinksBoard(
  employer: EmployerHint,
  boardPatterns: RegExp[],
  opts: { rateKey: string; perMinute: number; fetchImpl?: FetchLike },
): Promise<IdentityProbe> {
  const checkedAt = new Date();
  if (!employer.careersUrl || !employer.domain) {
    return { linked: null, checkedAt, detail: "No careers page on the employer's own domain is configured." };
  }
  let host: string;
  try {
    host = new URL(employer.careersUrl).hostname;
  } catch {
    return { linked: null, checkedAt, detail: "Configured careers URL is invalid." };
  }
  if (registrable(host) !== registrable(employer.domain)) {
    return { linked: null, checkedAt, detail: `Careers page ${host} isn't on the employer's domain ${employer.domain}.` };
  }
  try {
    const res = await politeFetch(employer.careersUrl, { ...opts, accept: "text/html" });
    if (!res.ok) return { linked: null, checkedAt, evidenceUrl: employer.careersUrl, detail: `Careers page returned HTTP ${res.status}.` };
    const html = await res.text();
    const linked = boardPatterns.some((p) => p.test(html));
    return {
      linked,
      checkedAt,
      evidenceUrl: employer.careersUrl,
      detail: linked
        ? `${employer.careersUrl} (on ${employer.domain}) links to this job board.`
        : `${employer.careersUrl} doesn't link to this job board.`,
    };
  } catch (e) {
    return { linked: null, checkedAt, evidenceUrl: employer.careersUrl, detail: `Couldn't check careers page: ${(e as Error).message}` };
  }
}
