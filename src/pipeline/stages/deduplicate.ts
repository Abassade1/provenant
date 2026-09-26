import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, employerDomain, jobSourceRecord, salaryEvidence } from "@/db/schema";
import {
  getScorer,
  MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
  type DedupeFeatures,
  type SimilarityResult,
} from "@/evidence/dedupe/similarity";
import { findOffPlatformContact, findUpfrontPayment, hostnameOf, isKnownAts, registrableDomain } from "@/verification";
import type { SalaryHint } from "@/sources/types";
import type { NormalizedPosting } from "./normalize";

export type DedupeDecision =
  | { kind: "SAME_SOURCE_RECORD"; canonicalJobId: string }
  | { kind: "MERGE"; canonicalJobId: string; result: SimilarityResult }
  | { kind: "REVIEW"; reviewWith: string; result: SimilarityResult; reason: string }
  | { kind: "NEW"; best: SimilarityResult | null };

export interface DedupeInput {
  sourceId: string;
  employerOwned: boolean;
  employerId: string;
  posting: NormalizedPosting;
  salary: SalaryHint | null;
  skills: string[];
}

function toFeatures(p: NormalizedPosting, salary: SalaryHint | null, skills: string[]): DedupeFeatures {
  return {
    titleNormalized: p.titleNormalized,
    description: p.description,
    city: p.city,
    province: p.province,
    remoteType: p.remoteType,
    salary: salary ? { min: salary.min ?? null, max: salary.max ?? null, period: salary.period ?? null, currency: salary.currency ?? "CAD" } : null,
    skills,
    urls: [p.url, p.applyUrl],
  };
}

/**
 * Blocking key: employer + normalized title stem + (city, or remote type when
 * there's no city). Within a block, score pairs; ≥ MERGE merges, between the
 * thresholds opens a REVIEW_REQUIRED cluster, below stays separate.
 */
export async function deduplicate(db: DB, input: DedupeInput): Promise<DedupeDecision> {
  const { posting: p } = input;

  const [same] = await db
    .select({ canonicalJobId: jobSourceRecord.canonicalJobId })
    .from(jobSourceRecord)
    .where(and(eq(jobSourceRecord.sourceId, input.sourceId), eq(jobSourceRecord.externalRef, p.externalRef)))
    .limit(1);
  if (same) return { kind: "SAME_SOURCE_RECORD", canonicalJobId: same.canonicalJobId };

  const locationClause = p.city
    ? sql`lower(${canonicalJob.city}) = lower(${p.city})`
    : and(isNull(canonicalJob.city), eq(canonicalJob.remoteType, p.remoteType));
  const candidates = await db
    .select()
    .from(canonicalJob)
    .where(
      and(
        eq(canonicalJob.employerId, input.employerId),
        eq(canonicalJob.titleStem, p.titleStem),
        isNull(canonicalJob.expiredAt),
        locationClause,
      ),
    )
    .limit(25);
  if (candidates.length === 0) return { kind: "NEW", best: null };

  const ids = candidates.map((c) => c.id);
  const [records, salaries, domains] = await Promise.all([
    db
      .select({ jobId: jobSourceRecord.canonicalJobId, sourceId: jobSourceRecord.sourceId, url: jobSourceRecord.url, applyUrl: jobSourceRecord.applyUrl })
      .from(jobSourceRecord)
      .where(inArray(jobSourceRecord.canonicalJobId, ids)),
    db
      .select()
      .from(salaryEvidence)
      .where(and(inArray(salaryEvidence.canonicalJobId, ids), eq(salaryEvidence.type, "EMPLOYER_STATED"))),
    db.select({ domain: employerDomain.domain }).from(employerDomain).where(eq(employerDomain.employerId, input.employerId)),
  ]);

  const incoming = toFeatures(p, input.salary, input.skills);
  const scorer = getScorer();
  let best: { job: (typeof candidates)[number]; result: SimilarityResult } | null = null;
  for (const job of candidates) {
    const s = salaries.find((x) => x.canonicalJobId === job.id);
    const recs = records.filter((r) => r.jobId === job.id);
    const features: DedupeFeatures = {
      titleNormalized: job.titleNormalized,
      description: job.description,
      city: job.city,
      province: job.province,
      remoteType: job.remoteType,
      salary: s ? { min: s.min ? Number(s.min) : null, max: s.max ? Number(s.max) : null, period: s.period, currency: s.currency } : null,
      skills: job.skills,
      urls: recs.flatMap((r) => [r.url, r.applyUrl].filter((u): u is string => !!u)),
    };
    const result = scorer.score(incoming, features);
    if (!best || result.score > best.result.score) best = { job, result };
  }
  if (!best || best.result.score < REVIEW_THRESHOLD) return { kind: "NEW", best: best?.result ?? null };

  // ── Guards: never auto-merge something that could launder trust ──────────
  const bestRecords = records.filter((r) => r.jobId === best.job.id);
  const blockers: string[] = [];
  if (bestRecords.some((r) => r.sourceId === input.sourceId)) {
    blockers.push("same source already lists a similar posting (could be a separate opening)");
  }
  if (!input.employerOwned) {
    const host = hostnameOf(p.applyUrl);
    const employerRegs = domains.map((d) => registrableDomain(d.domain));
    const candidateRegs = bestRecords.map((r) => hostnameOf(r.applyUrl)).filter(Boolean).map((h) => registrableDomain(h!));
    const applyOk = host && (isKnownAts(host) || employerRegs.includes(registrableDomain(host)) || candidateRegs.includes(registrableDomain(host)) || /(^|\.)jobbank\.gc\.ca$/.test(host));
    if (!applyOk) blockers.push(`apply link (${host ?? "none"}) doesn't match the employer or the existing listing`);
    if (findOffPlatformContact(p.description).length || findUpfrontPayment(p.description).length) {
      blockers.push("posting text contains job-scam patterns");
    }
  }

  if (best.result.score >= MERGE_THRESHOLD && blockers.length === 0) {
    return { kind: "MERGE", canonicalJobId: best.job.id, result: best.result };
  }
  return {
    kind: "REVIEW",
    reviewWith: best.job.id,
    result: best.result,
    reason: blockers.length ? blockers.join("; ") : "similarity between thresholds",
  };
}
