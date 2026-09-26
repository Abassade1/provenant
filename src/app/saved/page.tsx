import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { canonicalJob, employer, jobSourceRecord, savedJob, savedSearch } from "@/db/schema";
import { JobCard } from "@/components/job-card";
import { bestSalary, type SearchResultRow } from "@/evidence/search";
import { searchFiltersSchema, filtersToQueryString, type SearchFilters } from "@/lib/search-params";
import { DeleteSavedSearchButton } from "@/components/delete-saved-search-button";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  const db = getDb();

  const [jobs, searches] = await Promise.all([
    db
      .select({
        id: canonicalJob.id, title: canonicalJob.title, employerName: employer.displayName, employerIsDemo: employer.isDemo,
        city: canonicalJob.city, province: canonicalJob.province, remoteType: canonicalJob.remoteType, status: canonicalJob.status,
        isDemo: canonicalJob.isDemo, postedAt: canonicalJob.postedAt, firstSeenAt: canonicalJob.firstSeenAt, lastVerifiedAt: canonicalJob.lastVerifiedAt,
        salary: bestSalary,
        sourceCount: sql<number>`(select count(*)::int from ${jobSourceRecord} r where r.canonical_job_id = ${canonicalJob.id} and r.expired_at is null)`,
      })
      .from(savedJob)
      .innerJoin(canonicalJob, eq(canonicalJob.id, savedJob.canonicalJobId))
      .innerJoin(employer, eq(employer.id, canonicalJob.employerId))
      .where(eq(savedJob.userId, session.user.id))
      .orderBy(desc(savedJob.createdAt)),
    db.select().from(savedSearch).where(eq(savedSearch.userId, session.user.id)).orderBy(desc(savedSearch.createdAt)),
  ]);

  const rows: SearchResultRow[] = jobs.map((j) => ({
    ...j,
    salaryMin: j.salary?.min != null ? Number(j.salary.min) : null,
    salaryMax: j.salary?.max != null ? Number(j.salary.max) : null,
    salaryPeriod: j.salary?.period ?? null,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Saved jobs</h1>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted">Nothing saved yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((job) => (
            <JobCard key={job.id} job={job} saved signedIn />
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-semibold">Saved searches &amp; alerts</h2>
      {searches.length === 0 ? (
        <p className="mt-2 text-muted">No saved searches. Save one from the search page to get alerted about new matches.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {searches.map((s) => {
            const parsed = searchFiltersSchema.safeParse(s.filters as SearchFilters);
            return (
              <li key={s.id} className="flex items-center justify-between rounded border border-line p-3 text-sm">
                {parsed.success ? (
                  <a href={`/search${filtersToQueryString(parsed.data)}`} className="text-accent underline">
                    {s.name}
                  </a>
                ) : (
                  <span className="text-muted">{s.name} (filters no longer valid — delete and re-save)</span>
                )}
                <DeleteSavedSearchButton id={s.id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
