import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, employer, jobSourceRecord, salaryEvidence, source } from "@/db/schema";
import { currentSignals } from "./verify-job";
import type { PassportProps } from "@/components/passport";

/** Everything the Passport component needs, loaded from the database for one canonical job. */
export async function loadPassportProps(db: DB, jobId: string): Promise<PassportProps | null> {
  const [[row], signals, sources, salaries] = await Promise.all([
    db.select().from(canonicalJob).innerJoin(employer, eq(employer.id, canonicalJob.employerId)).where(eq(canonicalJob.id, jobId)),
    currentSignals(db, jobId),
    db
      .select({
        id: jobSourceRecord.id,
        sourceName: source.name,
        employerOwned: source.employerOwned,
        url: jobSourceRecord.url,
        lastVerifiedAt: jobSourceRecord.lastVerifiedAt,
        expiredAt: jobSourceRecord.expiredAt,
      })
      .from(jobSourceRecord)
      .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
      .where(eq(jobSourceRecord.canonicalJobId, jobId)),
    db.select().from(salaryEvidence).where(eq(salaryEvidence.canonicalJobId, jobId)),
  ]);
  if (!row) return null;
  const j = row.canonical_job;
  const emp = row.employer;

  return {
    isDemo: j.isDemo,
    title: j.title,
    employerName: emp.displayName,
    status: j.status,
    identityStatus: emp.identityStatus,
    employerDomain: emp.primaryDomain,
    salaries: salaries.map((s) => ({
      id: s.id,
      min: s.min != null ? Number(s.min) : null,
      max: s.max != null ? Number(s.max) : null,
      period: s.period,
      provenance: s.derived ? "extracted" : "employer",
    })),
    vacancyStatement: j.vacancyStatement,
    vacancyStatementDerived: j.vacancyStatementDerived,
    postedAt: j.postedAt ?? j.firstSeenAt,
    lastVerifiedAt: j.lastVerifiedAt,
    sources,
    signals: signals.map((s) => ({
      code: s.code as never,
      polarity: s.polarity,
      weight: s.weight,
      evidenceText: s.evidenceText,
      evidenceUrl: s.evidenceUrl ?? undefined,
      observedAt: s.observedAt,
      sourceId: s.sourceId ?? undefined,
    })),
    overrideNote: j.overrideStatus ? (j.overrideNote ?? "") : null,
    overrideAt: j.overrideAt,
  };
}
