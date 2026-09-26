import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, employer, employerAlias, employerDomain, jobSourceRecord, salaryEvidence, source } from "@/db/schema";
import { lexicalScorer, MERGE_THRESHOLD, salaryOverlap, type DedupeFeatures, type DedupeSalary } from "@/evidence/dedupe/similarity";
import { normalizeEmployerName } from "@/pipeline/stages/resolve-employer";
import { normalizeTitle, parseLocation } from "@/pipeline/stages/normalize";
import type { IdentityStatus, SourceRecordInput } from "@/verification";

/**
 * A structured alternative to the lexical dedupe score, for matching a short
 * paste against an indexed job by exact fields rather than prose overlap.
 * Needs an exact title match to fire at all — title is the one field a real
 * paste of the same job should always get right.
 */
function structuredScore(incoming: DedupeFeatures, candidate: DedupeFeatures, candidateSalary: DedupeSalary | null): number {
  if (incoming.titleNormalized !== candidate.titleNormalized) return 0;
  let score = 0.6; // exact title, same employer (blocking already guarantees this)
  if (incoming.city && candidate.city) score += incoming.city.toLowerCase() === candidate.city.toLowerCase() ? 0.25 : -0.3;
  else if (!incoming.city && !candidate.city) score += 0.1; // both unspecified — weak but not contradictory
  if (incoming.salary && candidateSalary) {
    const overlap = salaryOverlap(incoming.salary, candidateSalary);
    if (overlap != null) score += overlap >= 0.9 ? 0.25 : overlap >= 0.5 ? 0.1 : -0.3;
  }
  return Math.max(0, Math.min(1, score));
}

export interface EmployerMatch {
  id: string;
  name: string;
  identityStatus: IdentityStatus;
  domains: string[];
}

export interface JobMatch {
  canonicalJobId: string;
  score: number;
  isStrongMatch: boolean; // score >= MERGE_THRESHOLD — safe to inherit the indexed job's freshness signals
  sources: SourceRecordInput[];
  lastVerifiedAt: Date | null;
}

/** Look up an employer we already know by name (same normalization dedupe uses for aliasing). */
export async function findEmployer(db: DB, name: string): Promise<EmployerMatch | null> {
  const key = normalizeEmployerName(name);
  const [alias] = await db.select({ employerId: employerAlias.employerId }).from(employerAlias).where(eq(employerAlias.aliasNormalized, key));
  if (!alias) return null;
  const [emp] = await db.select().from(employer).where(eq(employer.id, alias.employerId));
  if (!emp) return null;
  const domains = await db
    .select({ domain: employerDomain.domain })
    .from(employerDomain)
    .where(and(eq(employerDomain.employerId, emp.id), eq(employerDomain.kind, "PRIMARY")));
  return { id: emp.id, name: emp.displayName, identityStatus: emp.identityStatus, domains: domains.map((d) => d.domain) };
}

/**
 * Look for an indexed job that's the checked posting, using our own
 * continuously-refreshed index as the stand-in for "look on the employer's
 * ATS/careers page" (brief §12.3) — that's exactly what ingestion already
 * keeps current. Blocks by employer + title stem + location, then scores
 * with the same similarity function dedupe uses.
 */
export async function findMatchingJob(
  db: DB,
  employerId: string,
  title: string,
  locationText: string | null,
  description: string,
  salary: DedupeSalary | null = null,
): Promise<JobMatch | null> {
  const { stem } = normalizeTitle(title);
  const loc = parseLocation(locationText);
  const candidates = await db
    .select()
    .from(canonicalJob)
    .where(and(eq(canonicalJob.employerId, employerId), eq(canonicalJob.titleStem, stem), isNull(canonicalJob.expiredAt)))
    .limit(10);
  if (candidates.length === 0) return null;

  const incoming: DedupeFeatures = {
    titleNormalized: normalizeTitle(title).normalized,
    description,
    city: loc.city,
    province: loc.province,
    remoteType: "UNKNOWN",
    salary,
    skills: [],
    urls: [],
  };

  const candidateSalaries = await db
    .select()
    .from(salaryEvidence)
    .where(and(inArray(salaryEvidence.canonicalJobId, candidates.map((c) => c.id)), eq(salaryEvidence.type, "EMPLOYER_STATED")));

  let best: { job: (typeof candidates)[number]; score: number } | null = null;
  for (const job of candidates) {
    const s = candidateSalaries.find((x) => x.canonicalJobId === job.id);
    const candidateSalary = s ? { min: s.min ? Number(s.min) : null, max: s.max ? Number(s.max) : null, period: s.period, currency: s.currency } : null;
    const features: DedupeFeatures = {
      titleNormalized: job.titleNormalized,
      description: job.description,
      city: job.city,
      province: job.province,
      remoteType: job.remoteType,
      salary: candidateSalary,
      skills: job.skills,
      urls: [],
    };
    // The dedupe scorer compares two *full* postings and leans on description
    // text; a short user paste ("Title: X / Company: Y / $72–90K") will never
    // score well against a full listing on text alone even when it's clearly
    // the same job. structuredScore rewards exact title/location/salary
    // agreement directly, so a precise short paste can still match strongly.
    const score = Math.max(lexicalScorer.score(incoming, features).score, structuredScore(incoming, features, candidateSalary));
    if (!best || score > best.score) best = { job, score };
  }
  if (!best) return null;

  const recs = await db
    .select({
      sourceId: source.id,
      sourceName: source.name,
      employerOwned: source.employerOwned,
      url: jobSourceRecord.url,
      applyUrl: jobSourceRecord.applyUrl,
      title: jobSourceRecord.title,
      locationText: jobSourceRecord.locationText,
      lastVerifiedAt: jobSourceRecord.lastVerifiedAt,
      expiredAt: jobSourceRecord.expiredAt,
    })
    .from(jobSourceRecord)
    .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
    .where(eq(jobSourceRecord.canonicalJobId, best.job.id));

  return {
    canonicalJobId: best.job.id,
    score: best.score,
    isStrongMatch: best.score >= MERGE_THRESHOLD,
    lastVerifiedAt: best.job.lastVerifiedAt,
    sources: recs.map((r) => {
      const rloc = parseLocation(r.locationText);
      return {
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        employerOwned: r.employerOwned,
        url: r.url,
        applyUrl: r.applyUrl,
        titleStem: normalizeTitle(r.title).stem,
        locationKey: `${(rloc.city ?? "").toLowerCase()}|${rloc.province ?? ""}|`,
        lastVerifiedAt: r.lastVerifiedAt,
        expiredAt: r.expiredAt,
      };
    }),
  };
}

export async function matchedJobSalaryStated(db: DB, canonicalJobId: string): Promise<boolean> {
  const rows = await db.select({ id: salaryEvidence.id }).from(salaryEvidence).where(and(eq(salaryEvidence.canonicalJobId, canonicalJobId), eq(salaryEvidence.type, "EMPLOYER_STATED")));
  return rows.length > 0;
}
