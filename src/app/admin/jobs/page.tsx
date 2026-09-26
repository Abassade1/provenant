import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { canonicalJob, employer, ingestionError, ingestionRun, jobSourceRecord, source } from "@/db/schema";
import { requireAdminDev } from "@/lib/admin-guard";
import { AdminNav } from "@/components/admin-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "—";

export default async function AdminJobsPage() {
  requireAdminDev();
  const db = getDb();

  const [jobs, runs, openErrors] = await Promise.all([
    db
      .select({
        id: canonicalJob.id,
        title: canonicalJob.title,
        employer: employer.displayName,
        city: canonicalJob.city,
        province: canonicalJob.province,
        remoteType: canonicalJob.remoteType,
        employmentType: canonicalJob.employmentType,
        status: canonicalJob.status,
        isDemo: canonicalJob.isDemo,
        firstSeenAt: canonicalJob.firstSeenAt,
        lastSeenAt: canonicalJob.lastSeenAt,
        sources: sql<number>`(select count(*)::int from ${jobSourceRecord} where ${jobSourceRecord.canonicalJobId} = ${canonicalJob.id})`,
      })
      .from(canonicalJob)
      .innerJoin(employer, eq(employer.id, canonicalJob.employerId))
      .orderBy(desc(canonicalJob.lastSeenAt), canonicalJob.title)
      .limit(500),
    db
      .select({
        id: ingestionRun.id,
        source: source.key,
        status: ingestionRun.status,
        startedAt: ingestionRun.startedAt,
        fetched: ingestionRun.fetched,
        upserted: ingestionRun.upserted,
        skipped: ingestionRun.skipped,
        errored: ingestionRun.errored,
      })
      .from(ingestionRun)
      .innerJoin(source, eq(source.id, ingestionRun.sourceId))
      .orderBy(desc(ingestionRun.startedAt))
      .limit(20),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(ingestionError)
      .where(sql`${ingestionError.deadLetteredAt} is not null and ${ingestionError.resolvedAt} is null`),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AdminNav active="/admin/jobs" />
      <h1 className="text-2xl font-semibold">Canonical jobs</h1>
      <p className="mt-1 text-sm text-muted">
        Raw admin view (Phase 2). {jobs.length} jobs · {openErrors[0]?.n ?? 0} dead-lettered ingestion errors.
        Status is UNVERIFIED for everything until the Phase 3 verification engine runs.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Canonical jobs</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              {["Title", "Employer", "Location", "Remote", "Type", "Status", "Sources", "First seen", "Last seen"].map((h) => (
                <th key={h} scope="col" className="py-2 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-line align-top">
                <td className="py-2 pr-4">
                  <Link href={`/admin/jobs/${j.id}`} className="text-accent underline">
                    {j.title}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {j.employer}
                  {j.isDemo && <span className="text-muted"> (demo)</span>}
                </td>
                <td className="py-2 pr-4">{[j.city, j.province].filter(Boolean).join(", ") || "—"}</td>
                <td className="py-2 pr-4">{j.remoteType}</td>
                <td className="py-2 pr-4">{j.employmentType}</td>
                <td className="py-2 pr-4">{j.status}</td>
                <td className="py-2 pr-4">{j.sources}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{fmt(j.firstSeenAt)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{fmt(j.lastSeenAt)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-muted">
                  No jobs yet. Run <code>npm run db:seed</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Recent ingestion runs</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              {["Source", "Status", "Started", "Fetched", "Upserted", "Skipped", "Errored"].map((h) => (
                <th key={h} scope="col" className="py-2 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2 pr-4 font-mono text-xs">{r.source}</td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{fmt(r.startedAt)}</td>
                <td className="py-2 pr-4">{r.fetched}</td>
                <td className="py-2 pr-4">{r.upserted}</td>
                <td className="py-2 pr-4">{r.skipped}</td>
                <td className="py-2 pr-4">{r.errored}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
