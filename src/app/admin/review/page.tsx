import { desc, eq, sql } from "drizzle-orm";
import { AdminNav } from "@/components/admin-nav";
import { ClusterActions } from "@/components/admin/cluster-actions";
import { ReportActions } from "@/components/admin/report-actions";
import { getDb } from "@/db/client";
import { canonicalJob, duplicateCluster, employer, jobReport, jobSourceRecord, source } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "—";

export default async function ReviewQueuePage() {
  await requireAdmin();
  const db = getDb();

  const [clusters, reports] = await Promise.all([
    db
      .select({
        id: duplicateCluster.id,
        score: duplicateCluster.score,
        features: duplicateCluster.features,
        createdAt: duplicateCluster.createdAt,
        jobs: sql<
          { id: string; title: string; employer: string; city: string | null; status: string; source: string }[]
        >`json_agg(json_build_object('id', ${canonicalJob.id}, 'title', ${canonicalJob.title}, 'employer', ${employer.displayName}, 'city', ${canonicalJob.city}, 'status', ${canonicalJob.status}, 'source', ${source.name}) order by ${source.employerOwned} desc)`,
      })
      .from(duplicateCluster)
      .innerJoin(jobSourceRecord, eq(jobSourceRecord.duplicateClusterId, duplicateCluster.id))
      .innerJoin(canonicalJob, eq(canonicalJob.id, jobSourceRecord.canonicalJobId))
      .innerJoin(employer, eq(employer.id, canonicalJob.employerId))
      .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
      .where(eq(duplicateCluster.status, "REVIEW_REQUIRED"))
      .groupBy(duplicateCluster.id)
      .orderBy(desc(duplicateCluster.createdAt))
      .limit(100),
    db
      .select({
        id: jobReport.id,
        reason: jobReport.reason,
        details: jobReport.details,
        createdAt: jobReport.createdAt,
        jobTitle: canonicalJob.title,
        jobId: canonicalJob.id,
      })
      .from(jobReport)
      .leftJoin(canonicalJob, eq(canonicalJob.id, jobReport.canonicalJobId))
      .where(eq(jobReport.status, "PENDING"))
      .orderBy(desc(jobReport.createdAt))
      .limit(100),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav active="/admin/review" />
      <h1 className="text-2xl font-semibold">Review queue</h1>
      <p className="mt-1 text-sm text-muted">
        Duplicate clusters between the merge and separate thresholds, and pending job reports. Every job here is held at
        REVIEW_REQUIRED until resolved.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Possible duplicates ({clusters.length})</h2>
      <ul className="mt-3 space-y-4">
        {clusters.map((c) => {
          const distinctJobs = [...new Map(c.jobs.map((j) => [j.id, j])).values()];
          return (
            <li key={c.id} className="rounded border border-line p-4 text-sm">
              <div className="text-muted">
                Similarity {c.score ? Number(c.score).toFixed(2) : "—"} · {fmt(c.createdAt)}
                {(c.features as { reason?: string } | null)?.reason && <> · {(c.features as { reason: string }).reason}</>}
              </div>
              <ul className="mt-2 space-y-1">
                {distinctJobs.map((j) => (
                  <li key={j.id}>
                    <strong>{j.title}</strong> — {j.employer}
                    {j.city ? `, ${j.city}` : ""} · {j.status} · via {j.source}
                  </li>
                ))}
              </ul>
              <ClusterActions clusterId={c.id} jobs={distinctJobs} />
            </li>
          );
        })}
        {clusters.length === 0 && <li className="text-muted">Nothing to review.</li>}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Pending reports ({reports.length})</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {reports.map((r) => (
          <li key={r.id} className="rounded border border-line p-3">
            <div className="text-muted">
              {fmt(r.createdAt)} · {r.jobTitle ?? "(job removed)"}
            </div>
            <div className="mt-1">
              <strong>{r.reason}</strong>
              {r.details && <> — {r.details}</>}
            </div>
            <ReportActions reportId={r.id} />
          </li>
        ))}
        {reports.length === 0 && <li className="text-muted">No pending reports.</li>}
      </ul>
    </main>
  );
}
