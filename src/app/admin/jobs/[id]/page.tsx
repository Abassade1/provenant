import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OverrideForm } from "@/components/admin/override-form";
import { getDb } from "@/db/client";
import { canonicalJob, employer, jobSourceRecord, salaryEvidence, source, verificationStatusHistory } from "@/db/schema";
import { currentSignals } from "@/evidence/verify-job";
import { requireAdmin } from "@/lib/admin-guard";
import { SIGNALS, STATUS_LABELS } from "@/verification";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "—";

/**
 * Admin evidence view — every signal with what we checked and why it means
 * what it means, straight from the same catalog the (Phase 4) public Job
 * Passport will use. This is how we QA the rule engine, not the consumer UI.
 */
export default async function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();

  const [[job], signals, records, salaries, history] = await Promise.all([
    db.select().from(canonicalJob).innerJoin(employer, eq(employer.id, canonicalJob.employerId)).where(eq(canonicalJob.id, id)),
    currentSignals(db, id),
    db
      .select({
        id: jobSourceRecord.id,
        sourceName: source.name,
        employerOwned: source.employerOwned,
        url: jobSourceRecord.url,
        applyUrl: jobSourceRecord.applyUrl,
        lastVerifiedAt: jobSourceRecord.lastVerifiedAt,
        lastSeenAt: jobSourceRecord.lastSeenAt,
        expiredAt: jobSourceRecord.expiredAt,
      })
      .from(jobSourceRecord)
      .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
      .where(eq(jobSourceRecord.canonicalJobId, id)),
    db.select().from(salaryEvidence).where(eq(salaryEvidence.canonicalJobId, id)),
    db.select().from(verificationStatusHistory).where(eq(verificationStatusHistory.canonicalJobId, id)).orderBy(desc(verificationStatusHistory.createdAt)),
  ]);
  if (!job) notFound();

  const j = job.canonical_job;
  const emp = job.employer;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin/jobs" className="text-sm text-accent underline">
        ← All jobs
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">
        {j.title} · {emp.displayName}
        {j.isDemo && <span className="text-muted"> (demo)</span>}
      </h1>

      <section className="mt-6 rounded border border-line p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted">Job Passport</h2>
        <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Status</dt>
          <dd>
            {STATUS_LABELS[j.status]}
            {j.isDemo && j.status === "VERIFIED" ? " (demo)" : ""} · rule {j.statusRule ?? "—"}
          </dd>
          <dt className="text-muted">Employer</dt>
          <dd>
            {emp.displayName} — identity {emp.identityStatus}
            {emp.primaryDomain && ` (${emp.primaryDomain})`}
          </dd>
          <dt className="text-muted">Salary</dt>
          <dd>
            {salaries.length === 0
              ? "Salary not disclosed."
              : salaries.map((s) => (
                  <div key={s.id}>
                    {s.min && s.max ? `$${Number(s.min).toLocaleString()}–$${Number(s.max).toLocaleString()}` : `$${Number(s.min ?? s.max).toLocaleString()}`}
                    {s.period ? ` / ${s.period.toLowerCase()}` : ""} — {s.derived ? "extracted automatically" : "employer stated"}
                  </div>
                ))}
          </dd>
          <dt className="text-muted">Vacancy statement</dt>
          <dd>{j.vacancyStatement ? `“${j.vacancyStatement}”${j.vacancyStatementDerived ? " (extracted automatically)" : ""}` : "Not disclosed."}</dd>
          <dt className="text-muted">Posted</dt>
          <dd>{fmt(j.postedAt ?? j.firstSeenAt)}</dd>
          <dt className="text-muted">Last confirmed</dt>
          <dd>
            {fmt(j.lastVerifiedAt)}
            {j.lastVerifiedAt && Date.now() - j.lastVerifiedAt.getTime() > 7 * 86_400_000 && " — may be closed"}
          </dd>
          <dt className="text-muted">Also found on</dt>
          <dd>{records.length} source{records.length === 1 ? "" : "s"}</dd>
        </dl>
      </section>

      <section className="mt-6">
        <OverrideForm jobId={id} current={{ status: j.overrideStatus, note: j.overrideNote }} />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Signals ({signals.length})</h2>
        <ul className="mt-3 space-y-3">
          {signals.map((s) => {
            const def = SIGNALS[s.code as keyof typeof SIGNALS];
            return (
              <li key={s.id} className="rounded border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{s.polarity === "POSITIVE" ? "✓" : s.polarity === "NEGATIVE" ? "✕" : "•"}</span>
                  <strong>{def?.label ?? s.code}</strong>
                  <span className="text-xs text-muted">({s.polarity.toLowerCase()})</span>
                </div>
                <p className="mt-1 text-muted">{def?.checked}</p>
                <p className="mt-1">
                  {s.evidenceUrl ? (
                    <a href={s.evidenceUrl} className="text-accent underline" target="_blank" rel="noreferrer">
                      {s.evidenceText}
                    </a>
                  ) : (
                    s.evidenceText
                  )}
                </p>
                <p className="mt-1 text-muted">{def?.meaning}</p>
              </li>
            );
          })}
          {signals.length === 0 && <li className="text-muted">No signals yet.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Sources ({records.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {records.map((r) => (
            <li key={r.id} className="rounded border border-line p-3">
              <div>
                {r.sourceName} {r.employerOwned && <span className="text-accent">(employer-owned)</span>}
                {r.expiredAt && <span className="text-muted"> — removed {fmt(r.expiredAt)}</span>}
              </div>
              <div className="text-muted">
                <a href={r.url} className="underline" target="_blank" rel="noreferrer">
                  {r.url}
                </a>
              </div>
              <div className="text-muted">Last confirmed: {fmt(r.lastVerifiedAt)} · Last seen: {fmt(r.lastSeenAt)}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Status history</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {history.map((h) => (
            <li key={h.id}>
              {fmt(h.createdAt)}: {h.fromStatus ?? "(new)"} → {h.toStatus} ({h.reason})
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm">
        <Link href="/docs/verification" className="text-accent underline">
          How verification works
        </Link>
      </p>
    </main>
  );
}
