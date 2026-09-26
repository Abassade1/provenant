import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  canonicalJob,
  duplicateCluster,
  employer,
  employerDomain,
  jobReport,
  jobSourceRecord,
  salaryEvidence,
  source,
  verificationSignal,
  verificationStatusHistory,
} from "@/db/schema";
import { normalizeTitle, parseLocation } from "@/pipeline/stages/normalize";
import { verify, type VerificationInput, type VerificationResult } from "@/verification";

function locationKey(city: string | null, province: string | null, remote: string) {
  return `${(city ?? "").toLowerCase()}|${province ?? ""}|${city ? "" : remote}`;
}

/**
 * Build the verification input for one canonical job. This is the only bridge
 * between the database and src/verification — it deliberately selects
 * evidence columns only (no user, plan or billing data).
 */
export async function loadVerificationInput(db: DB, jobId: string, now: Date, knownEmployerDomains?: string[]): Promise<VerificationInput | null> {
  const [job] = await db.select().from(canonicalJob).where(eq(canonicalJob.id, jobId));
  if (!job) return null;

  const [emp] = await db.select().from(employer).where(eq(employer.id, job.employerId));
  const [domains, boards, records, salaries, reporters, clusters, allDomains] = await Promise.all([
    db
      .select({ domain: employerDomain.domain })
      .from(employerDomain)
      .where(and(eq(employerDomain.employerId, job.employerId), inArray(employerDomain.kind, ["PRIMARY", "CAREERS"]))),
    db
      .select({ lastSuccessAt: source.lastSuccessAt })
      .from(source)
      .where(and(eq(source.employerId, job.employerId), eq(source.employerOwned, true), eq(source.enabled, true))),
    db
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
      .where(eq(jobSourceRecord.canonicalJobId, jobId)),
    db
      .select({
        sourceId: salaryEvidence.sourceId,
        type: salaryEvidence.type,
        min: salaryEvidence.min,
        max: salaryEvidence.max,
        period: salaryEvidence.period,
        currency: salaryEvidence.currency,
        evidenceText: salaryEvidence.evidenceText,
        employerOwned: source.employerOwned,
      })
      .from(salaryEvidence)
      .leftJoin(source, eq(source.id, salaryEvidence.sourceId))
      .where(eq(salaryEvidence.canonicalJobId, jobId)),
    db
      .select({ n: sql<number>`count(distinct coalesce(${jobReport.userId}::text, ${jobReport.id}::text))::int` })
      .from(jobReport)
      .where(and(eq(jobReport.canonicalJobId, jobId), eq(jobReport.status, "PENDING"))),
    db
      .select({ id: duplicateCluster.id })
      .from(jobSourceRecord)
      .innerJoin(duplicateCluster, eq(duplicateCluster.id, jobSourceRecord.duplicateClusterId))
      .where(and(eq(jobSourceRecord.canonicalJobId, jobId), eq(duplicateCluster.status, "REVIEW_REQUIRED")))
      .limit(1),
    knownEmployerDomains
      ? Promise.resolve(null)
      : db.select({ d: employer.primaryDomain }).from(employer).where(isNotNull(employer.primaryDomain)),
  ]);

  const boardChecked = boards.map((b) => b.lastSuccessAt).filter((d): d is Date => !!d);
  return {
    now,
    job: {
      applyUrl: job.applyUrl,
      text: job.description,
      vacancyStatement: job.vacancyStatement,
      firstSeenAt: job.firstSeenAt,
      lastVerifiedAt: job.lastVerifiedAt,
      expiredAt: job.expiredAt,
    },
    employer: emp
      ? {
          name: emp.displayName,
          identityStatus: emp.identityStatus,
          identityEvidence: emp.identityEvidence,
          domains: domains.map((d) => d.domain),
          hasEmployerBoard: boards.length > 0,
          employerBoardCheckedAt: boardChecked.length ? new Date(Math.max(...boardChecked.map((d) => d.getTime()))) : null,
        }
      : null,
    sources: records.map((r) => {
      const loc = parseLocation(r.locationText);
      return {
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        employerOwned: r.employerOwned,
        url: r.url,
        applyUrl: r.applyUrl,
        titleStem: normalizeTitle(r.title).stem,
        locationKey: locationKey(loc.city, loc.province, loc.remoteHint),
        lastVerifiedAt: r.lastVerifiedAt,
        expiredAt: r.expiredAt,
      };
    }),
    salaries: salaries.map((s) => ({
      sourceId: s.sourceId,
      type: s.type,
      min: s.min != null ? Number(s.min) : null,
      max: s.max != null ? Number(s.max) : null,
      period: s.period,
      currency: s.currency,
      employerHosted: !!s.employerOwned,
      evidenceText: s.evidenceText,
    })),
    pendingReporters: reporters[0]?.n ?? 0,
    openDuplicateCluster: clusters.length > 0,
    override: job.overrideStatus && job.overrideAt ? { status: job.overrideStatus, at: job.overrideAt, note: job.overrideNote } : null,
    knownEmployerDomains: knownEmployerDomains ?? (allDomains ?? []).map((r) => r.d!).filter(Boolean),
  };
}

/** Run verification for one job and persist signals, status and history. */
export async function verifyJob(db: DB, jobId: string, now: Date, knownEmployerDomains?: string[]): Promise<VerificationResult | null> {
  const input = await loadVerificationInput(db, jobId, now, knownEmployerDomains);
  if (!input) return null;
  const result = verify(input);

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ status: canonicalJob.status, statusRule: canonicalJob.statusRule, isDemo: canonicalJob.isDemo, verifiedAt: canonicalJob.verifiedAt })
      .from(canonicalJob)
      .where(eq(canonicalJob.id, jobId));
    await tx
      .update(verificationSignal)
      .set({ supersededAt: now })
      .where(and(eq(verificationSignal.subjectType, "JOB"), eq(verificationSignal.subjectId, jobId), isNull(verificationSignal.supersededAt)));
    if (result.signals.length) {
      await tx.insert(verificationSignal).values(
        result.signals.map((s) => ({
          subjectType: "JOB" as const,
          subjectId: jobId,
          code: s.code,
          polarity: s.polarity,
          weight: s.weight,
          evidenceText: s.evidenceText,
          evidenceUrl: s.evidenceUrl ?? null,
          observedAt: s.observedAt,
          sourceId: s.sourceId ?? null,
          isDemo: job!.isDemo,
        })),
      );
    }
    await tx
      .update(canonicalJob)
      .set({ status: result.status, statusRule: result.ruleId, verifiedAt: now })
      .where(eq(canonicalJob.id, jobId));
    if (!job!.verifiedAt || job!.status !== result.status) {
      await tx.insert(verificationStatusHistory).values({
        canonicalJobId: jobId,
        fromStatus: job!.verifiedAt ? job!.status : null,
        toStatus: result.status,
        reason: result.ruleId === "R0" ? "ADMIN_OVERRIDE" : result.ruleId,
        isDemo: job!.isDemo,
      });
    }
  });
  return result;
}

export async function knownDomains(db: DB): Promise<string[]> {
  const rows = await db.select({ d: employer.primaryDomain }).from(employer).where(isNotNull(employer.primaryDomain));
  return rows.map((r) => r.d!);
}

/** Current (non-superseded) signals for a job, strongest first. */
export function currentSignals(db: DB, jobId: string) {
  return db
    .select()
    .from(verificationSignal)
    .where(and(eq(verificationSignal.subjectType, "JOB"), eq(verificationSignal.subjectId, jobId), isNull(verificationSignal.supersededAt)))
    .orderBy(desc(verificationSignal.weight));
}
