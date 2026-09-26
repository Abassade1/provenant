/** Hiring systems employers commonly use to host applications. */
export const KNOWN_ATS_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "myworkdayjobs.com",
  "myworkdaysite.com",
  "smartrecruiters.com",
  "icims.com",
  "bamboohr.com",
  "workable.com",
  "jobvite.com",
  "taleo.net",
  "successfactors.com",
  "successfactors.eu",
  "recruitee.com",
  "breezy.hr",
  "jazzhr.com",
  "applytojob.com",
  "ultipro.com",
  "dayforcehcm.com",
];

/** Public job boards run by governments, where the posting page explains how to apply. */
export const KNOWN_PUBLIC_BOARDS = ["jobbank.gc.ca", "guichetemplois.gc.ca"];

export function isKnownPublicBoard(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return KNOWN_PUBLIC_BOARDS.some((b) => h === b || h.endsWith("." + b));
}

// Small public-suffix list: enough for Canadian and common domains. Anything
// else falls back to "last two labels".
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.in", "com.br",
  "gc.ca", "on.ca", "qc.ca", "bc.ca", "ab.ca", "mb.ca", "sk.ca", "ns.ca", "nb.ca", "nl.ca", "pe.ca",
]);

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** eTLD+1, e.g. jobs.northwindlabs.example → northwindlabs.example */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

function brandLabel(domain: string): string {
  const reg = registrableDomain(domain);
  const suffixLabels = MULTI_PART_SUFFIXES.has(reg.split(".").slice(-2).join(".")) ? 2 : 1;
  return reg.split(".").slice(0, -suffixLabels).join(".");
}

export function isKnownAts(host: string): boolean {
  const reg = registrableDomain(host);
  return KNOWN_ATS_DOMAINS.includes(reg);
}

export function isEmployerDomain(host: string, employerDomains: string[]): boolean {
  const reg = registrableDomain(host);
  return employerDomains.some((d) => registrableDomain(d) === reg);
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/**
 * Returns the known domain that `host` imitates, or null.
 * Lookalike = not the same registrable domain, and either within edit
 * distance 2 of the brand, or the brand with words bolted on
 * ("northwindlabs-careers", "northwind-labs-hr").
 */
export function lookalikeOf(host: string, knownDomains: string[]): string | null {
  if (isKnownAts(host) || isKnownPublicBoard(host)) return null;
  const reg = registrableDomain(host);
  const brand = brandLabel(host).replace(/-/g, "");
  for (const known of knownDomains) {
    const kReg = registrableDomain(known);
    if (kReg === reg) return null; // it's a real known domain
  }
  for (const known of knownDomains) {
    const kBrand = brandLabel(known).replace(/-/g, "");
    if (kBrand.length < 5) continue; // too short to judge
    // Registrable domains already differ (checked above), so an identical brand
    // on another domain ("northwind-labs.example", "northwindlabs.co") counts too.
    if (brand === kBrand || levenshtein(brand, kBrand) <= 2 || brand.includes(kBrand)) {
      return registrableDomain(known);
    }
  }
  return null;
}
