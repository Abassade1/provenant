import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";
import { ApplyButton } from "@/components/apply-button";
import { Passport } from "@/components/passport";
import { SaveButton } from "@/components/save-button";
import { ReportButton } from "@/components/report-button";
import { getDb } from "@/db/client";
import { canonicalJob, employer, jobSourceRecord, salaryEvidence, savedJob } from "@/db/schema";
import { loadPassportProps } from "@/evidence/passport-data";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "—";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const session = await getSession();

  const [[row], passport, sourceHistory, saved] = await Promise.all([
    db.select().from(canonicalJob).innerJoin(employer, eq(employer.id, canonicalJob.employerId)).where(eq(canonicalJob.id, id)),
    loadPassportProps(db, id),
    db
      .select({
        id: jobSourceRecord.id,
        url: jobSourceRecord.url,
        firstSeenAt: jobSourceRecord.firstSeenAt,
        lastSeenAt: jobSourceRecord.lastSeenAt,
        lastVerifiedAt: jobSourceRecord.lastVerifiedAt,
        expiredAt: jobSourceRecord.expiredAt,
      })
      .from(jobSourceRecord)
      .where(eq(jobSourceRecord.canonicalJobId, id))
      .orderBy(desc(jobSourceRecord.lastSeenAt)),
    session?.user
      ? db
          .select({ id: savedJob.id })
          .from(savedJob)
          .where(and(eq(savedJob.canonicalJobId, id), eq(savedJob.userId, session.user.id)))
          .then((r) => r.length > 0)
      : Promise.resolve(false),
  ]);
  if (!row || !passport) notFound();
  const j = row.canonical_job;

  const salaryRows = await db.select().from(salaryEvidence).where(eq(salaryEvidence.canonicalJobId, id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/search" className="text-sm text-accent underline">
        ← Search
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {j.title} · {row.employer.displayName}
        </h1>
        <SaveButton jobId={id} initialSaved={saved} signedIn={!!session?.user} />
      </div>
      <p className="text-sm text-muted">
        {[j.city, j.province].filter(Boolean).join(", ") || (j.remoteType === "REMOTE" ? "Remote" : "")} · {j.employmentType.replaceAll("_", " ").toLowerCase()}
      </p>

      <div className="mt-6">
        <Passport {...passport} expanded />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{j.description || "No description provided."}</p>
      </section>

      {j.skills.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Skills</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {j.skills.map((s) => (
              <li key={s} className="rounded-full border border-line px-3 py-1 text-xs">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Salary evidence</h2>
        {salaryRows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Salary not disclosed.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {salaryRows.map((s) => (
              <li key={s.id} className="rounded border border-line p-3">
                {s.min && s.max ? `$${Number(s.min).toLocaleString()}–$${Number(s.max).toLocaleString()}` : `$${Number(s.min ?? s.max).toLocaleString()}`}
                {s.period ? ` / ${s.period.toLowerCase()}` : ""} —{" "}
                {s.derived ? "extracted automatically" : "employer advertised"}: “{s.evidenceText}”
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Source history</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {sourceHistory.map((s) => (
            <li key={s.id} className="rounded border border-line p-3">
              <a href={s.url} className="text-accent underline" target="_blank" rel="noreferrer">
                {s.url}
              </a>
              <div className="text-muted">
                First seen {fmt(s.firstSeenAt)} · Last seen {fmt(s.lastSeenAt)} · Last confirmed {fmt(s.lastVerifiedAt)}
                {s.expiredAt && ` · Removed ${fmt(s.expiredAt)}`}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex items-center gap-4 rounded-lg border border-line bg-[var(--bg)] p-4">
        <ApplyButton jobId={id} applyUrl={j.applyUrl} caution={passport.signals.some((s) => s.code === "APPLY_URL_MISMATCH" || s.code === "LOOKALIKE_DOMAIN")} />
        <ReportButton jobId={id} />
      </div>
    </main>
  );
}
