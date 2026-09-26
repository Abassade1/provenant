import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, duplicateCluster, jobSourceRecord, salaryEvidence, source } from "@/db/schema";
import type { SalaryHint } from "@/sources/types";
import type { DedupeDecision } from "./deduplicate";
import type { NormalizedPosting } from "./normalize";

export interface ExtractedEvidence {
  salary: SalaryHint | null;
  salaryDerived: { model: string } | null;
  vacancyStatement: string | null;
  vacancyDerived: boolean;
  skills: string[];
}

export interface UpsertInput {
  sourceId: string;
  employerOwned: boolean;
  rawPostingId: string;
  employerId: string;
  decision: DedupeDecision;
  posting: NormalizedPosting;
  evidence: ExtractedEvidence;
  isDemo: boolean;
  now: Date;
}

/**
 * Create or refresh the canonical job, its source record, salary evidence and
 * any duplicate cluster. Returns the canonical job id.
 *
 * Canonical fields come from the most authoritative source: an employer-owned
 * record overwrites; an aggregator only fills a job it created.
 */
export async function upsertJob(db: DB, input: UpsertInput): Promise<string> {
  const { posting: p, now, isDemo, evidence: ev, decision } = input;
  return db.transaction(async (tx) => {
    const fields = {
      title: p.title,
      titleNormalized: p.titleNormalized,
      titleStem: p.titleStem,
      city: p.city,
      province: p.province,
      remoteType: p.remoteType,
      employmentType: p.employmentType,
      description: p.description,
      skills: ev.skills,
      applyUrl: p.applyUrl,
      postedAt: p.postedAt,
      vacancyStatement: ev.vacancyStatement,
      vacancyStatementDerived: ev.vacancyDerived,
    };

    let jobId: string;
    if (decision.kind === "SAME_SOURCE_RECORD" || decision.kind === "MERGE") {
      jobId = decision.canonicalJobId;
      let overwrite = input.employerOwned;
      if (!overwrite) {
        // Aggregator may refresh fields only if no employer-owned record backs this job.
        const owned = await tx
          .select({ id: jobSourceRecord.id })
          .from(jobSourceRecord)
          .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
          .where(and(eq(jobSourceRecord.canonicalJobId, jobId), eq(source.employerOwned, true), isNull(jobSourceRecord.expiredAt)))
          .limit(1);
        overwrite = owned.length === 0 && decision.kind === "SAME_SOURCE_RECORD";
      }
      await tx
        .update(canonicalJob)
        .set(overwrite ? { ...fields, lastSeenAt: now, expiredAt: null } : { lastSeenAt: now })
        .where(eq(canonicalJob.id, jobId));
    } else {
      const [row] = await tx
        .insert(canonicalJob)
        .values({ ...fields, employerId: input.employerId, firstSeenAt: now, lastSeenAt: now, isDemo })
        .returning({ id: canonicalJob.id });
      jobId = row!.id;
    }

    const matchScore = decision.kind === "MERGE" || decision.kind === "REVIEW" ? String(decision.result.score) : null;
    // Seeing a posting on the employer's own board *is* confirmation that it's listed.
    const verified = input.employerOwned ? now : null;
    const [rec] = await tx
      .insert(jobSourceRecord)
      .values({
        canonicalJobId: jobId,
        sourceId: input.sourceId,
        rawPostingId: input.rawPostingId,
        externalRef: p.externalRef,
        url: p.url,
        applyUrl: p.applyUrl,
        title: p.title,
        locationText: p.locationText,
        postedAt: p.postedAt,
        firstSeenAt: now,
        lastSeenAt: now,
        lastVerifiedAt: verified,
        matchScore,
        isDemo,
      })
      .onConflictDoUpdate({
        target: [jobSourceRecord.sourceId, jobSourceRecord.externalRef],
        set: {
          rawPostingId: input.rawPostingId,
          url: p.url,
          applyUrl: p.applyUrl,
          title: p.title,
          locationText: p.locationText,
          postedAt: p.postedAt,
          lastSeenAt: now,
          ...(verified ? { lastVerifiedAt: verified } : {}),
          expiredAt: null,
        },
      })
      .returning({ id: jobSourceRecord.id });

    // Duplicate clusters: an audit trail for merges, a review queue item otherwise.
    if (decision.kind === "MERGE" || decision.kind === "REVIEW") {
      const [cluster] = await tx
        .insert(duplicateCluster)
        .values({
          status: decision.kind === "MERGE" ? "AUTO_MERGED" : "REVIEW_REQUIRED",
          score: String(decision.result.score),
          features: { ...decision.result.features, ...(decision.kind === "REVIEW" ? { reason: decision.reason } : {}) },
          isDemo,
        })
        .returning({ id: duplicateCluster.id });
      const related = decision.kind === "MERGE" ? decision.canonicalJobId : decision.reviewWith;
      const relatedRecords = await tx
        .select({ id: jobSourceRecord.id })
        .from(jobSourceRecord)
        .where(eq(jobSourceRecord.canonicalJobId, related));
      await tx
        .update(jobSourceRecord)
        .set({ duplicateClusterId: cluster!.id })
        .where(inArray(jobSourceRecord.id, [rec!.id, ...relatedRecords.map((r) => r.id)]));
    }

    // Salary evidence: one current row per (job, source).
    await tx.delete(salaryEvidence).where(and(eq(salaryEvidence.canonicalJobId, jobId), eq(salaryEvidence.sourceId, input.sourceId)));
    if (ev.salary) {
      await tx.insert(salaryEvidence).values({
        canonicalJobId: jobId,
        sourceId: input.sourceId,
        min: ev.salary.min != null ? String(ev.salary.min) : null,
        max: ev.salary.max != null ? String(ev.salary.max) : null,
        currency: ev.salary.currency ?? "CAD",
        period: ev.salary.period ?? null,
        type: "EMPLOYER_STATED",
        evidenceText: ev.salary.text,
        derived: !!ev.salaryDerived,
        model: ev.salaryDerived?.model ?? null,
        observedAt: now,
        isDemo,
      });
    }
    return jobId;
  });
}
