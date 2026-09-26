import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { savedJob } from "@/db/schema";
import { JobCard } from "@/components/job-card";
import { SaveSearchForm } from "@/components/save-search-form";
import { searchJobs } from "@/evidence/search";
import { track } from "@/lib/analytics";
import { filtersToQueryString, parseSearchFilters } from "@/lib/search-params";

export const dynamic = "force-dynamic";

const REMOTE_TYPES = ["ONSITE", "HYBRID", "REMOTE"] as const;
const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "SEASONAL"] as const;
const STATUSES = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "STALE", "REVIEW_REQUIRED", "HIGH_RISK"] as const;
const SOURCE_TYPES = ["ATS_PUBLIC_BOARD", "EMPLOYER_CAREER_PAGE", "GOVERNMENT_OPEN_DATA", "LICENSED_FEED", "EMPLOYER_SUBMITTED", "DEMO"] as const;
const label = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseSearchFilters(sp);
  const db = getDb();
  const session = await getSession();

  const [result, savedIds] = await Promise.all([
    searchJobs(db, filters),
    session?.user
      ? db
          .select({ jobId: savedJob.canonicalJobId })
          .from(savedJob)
          .where(eq(savedJob.userId, session.user.id))
          .then((rows) => new Set(rows.map((r) => r.jobId)))
      : Promise.resolve(new Set<string>()),
  ]);
  track("search_performed", { userId: session?.user?.id, properties: { filters, resultCount: result.total } });

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const withPage = (page: number) => `/search${filtersToQueryString({ ...filters, page })}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Search verified jobs</h1>
      <p className="mt-1 text-sm text-muted">
        Built only from sources we're allowed to use — employer job boards, government open data, and employer
        submissions. Every result carries a Job Passport.
      </p>

      <form method="GET" className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-line p-4 sm:grid-cols-4" aria-label="Search filters">
        <div className="col-span-2 sm:col-span-4">
          <label htmlFor="q" className="text-xs text-muted">
            Keyword or title
          </label>
          <input id="q" name="q" defaultValue={filters.q ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="employer" className="text-xs text-muted">
            Employer
          </label>
          <input id="employer" name="employer" defaultValue={filters.employer ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="city" className="text-xs text-muted">
            City
          </label>
          <input id="city" name="city" defaultValue={filters.city ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="remoteType" className="text-xs text-muted">
            Remote type
          </label>
          <select id="remoteType" name="remoteType" defaultValue={filters.remoteType ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any</option>
            {REMOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="employmentType" className="text-xs text-muted">
            Employment type
          </label>
          <select id="employmentType" name="employmentType" defaultValue={filters.employmentType ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="salaryMin" className="text-xs text-muted">
            Min salary (annual, employer-stated)
          </label>
          <input
            id="salaryMin"
            name="salaryMin"
            type="number"
            min={0}
            defaultValue={filters.salaryMin ?? ""}
            className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="text-xs text-muted">
            Verification status
          </label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sourceType" className="text-xs text-muted">
            Source type
          </label>
          <select id="sourceType" name="sourceType" defaultValue={filters.sourceType ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="postedWithinDays" className="text-xs text-muted">
            Posted within
          </label>
          <select id="postedWithinDays" name="postedWithinDays" defaultValue={filters.postedWithinDays ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any time</option>
            <option value="1">24 hours</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        <div>
          <label htmlFor="confirmedWithinDays" className="text-xs text-muted">
            Last confirmed within
          </label>
          <select id="confirmedWithinDays" name="confirmedWithinDays" defaultValue={filters.confirmedWithinDays ?? ""} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="">Any time</option>
            <option value="1">24 hours</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="text-xs text-muted">
            Sort
          </label>
          <select id="sort" name="sort" defaultValue={filters.sort} className="mt-1 w-full rounded border border-line bg-transparent px-2 py-1.5 text-sm">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="confirmed">Last confirmed</option>
            <option value="salary">Salary</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
          <button type="submit" className="rounded bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--bg)]">
            Search
          </button>
          {(filters.q || filters.employer || filters.city) && <Link href="/search" className="text-sm text-muted underline">Clear</Link>}
        </div>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {result.total} result{result.total === 1 ? "" : "s"}
          {filters.sort === "salary" && " · jobs without a salary sort last and say so"}
        </p>
        <SaveSearchForm filters={filters} signedIn={!!session?.user} />
      </div>

      {result.rows.length === 0 ? (
        <p className="mt-8 rounded border border-line p-6 text-center text-muted">
          No jobs match these filters yet. Try widening them, or{" "}
          <Link href="/check" className="text-accent underline">
            check a specific job
          </Link>{" "}
          you already found elsewhere.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {result.rows.map((job) => (
            <JobCard key={job.id} job={job} saved={savedIds.has(job.id)} signedIn={!!session?.user} />
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-4 text-sm" aria-label="Pagination">
          {filters.page > 1 && (
            <Link href={withPage(filters.page - 1)} className="text-accent underline">
              ← Previous
            </Link>
          )}
          <span className="text-muted">
            Page {filters.page} of {pageCount}
          </span>
          {filters.page < pageCount && (
            <Link href={withPage(filters.page + 1)} className="text-accent underline">
              Next →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
