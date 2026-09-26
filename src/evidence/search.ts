import { and, desc, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, employer, jobSourceRecord, salaryEvidence } from "@/db/schema";
import type { SearchFilters } from "@/lib/search-params";

const PAGE_SIZE = 20;
const DAY = 86_400_000;

export interface SearchResultRow {
  id: string;
  title: string;
  employerName: string;
  employerIsDemo: boolean;
  city: string | null;
  province: string | null;
  remoteType: string;
  status: string;
  isDemo: boolean;
  postedAt: Date | null;
  firstSeenAt: Date;
  lastVerifiedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  sourceCount: number;
}

export interface SearchResult {
  rows: SearchResultRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** One representative employer-stated salary row per job, for display and sorting. */
export const bestSalary = sql<{ min: string | null; max: string | null; period: string | null } | null>`(
  select json_build_object('min', s.min, 'max', s.max, 'period', s.period)
  from ${salaryEvidence} s
  where s.canonical_job_id = ${canonicalJob.id} and s.type = 'EMPLOYER_STATED'
  order by s.max desc nulls last, s.min desc nulls last
  limit 1
)`;

export async function searchJobs(db: DB, f: SearchFilters): Promise<SearchResult> {
  const conditions: SQL[] = [isNull(canonicalJob.expiredAt)];

  if (f.q) conditions.push(sql`${canonicalJob.searchTsv} @@ websearch_to_tsquery('english', ${f.q})`);
  if (f.employer) conditions.push(sql`${employer.displayName} ilike ${"%" + f.employer + "%"}`);
  if (f.city) conditions.push(sql`${canonicalJob.city} ilike ${"%" + f.city + "%"}`);
  if (f.province) conditions.push(eq(canonicalJob.province, f.province));
  if (f.remoteType) conditions.push(eq(canonicalJob.remoteType, f.remoteType));
  if (f.employmentType) conditions.push(eq(canonicalJob.employmentType, f.employmentType));
  if (f.status) conditions.push(eq(canonicalJob.status, f.status));
  if (f.postedWithinDays) conditions.push(gte(canonicalJob.firstSeenAt, new Date(Date.now() - f.postedWithinDays * DAY)));
  if (f.confirmedWithinDays) conditions.push(gte(canonicalJob.lastVerifiedAt, new Date(Date.now() - f.confirmedWithinDays * DAY)));
  if (f.sourceType) {
    conditions.push(
      sql`exists (select 1 from ${jobSourceRecord} r join source src on src.id = r.source_id where r.canonical_job_id = ${canonicalJob.id} and src.type = ${f.sourceType})`,
    );
  }
  if (f.salaryMin != null) {
    // Employer-stated salary only (brief §13); annualize hourly so a $/hr min filters correctly.
    conditions.push(sql`exists (
      select 1 from ${salaryEvidence} s where s.canonical_job_id = ${canonicalJob.id} and s.type = 'EMPLOYER_STATED'
      and coalesce(s.max, s.min) * (case s.period when 'HOUR' then 2080 when 'DAY' then 260 when 'WEEK' then 52 when 'MONTH' then 12 else 1 end) >= ${f.salaryMin}
    )`);
  }

  const where = and(...conditions);
  const salaryOrder = sql`(select coalesce(s.max, s.min) from ${salaryEvidence} s where s.canonical_job_id = ${canonicalJob.id} and s.type = 'EMPLOYER_STATED' order by s.max desc nulls last limit 1)`;
  const orderBy =
    f.sort === "newest"
      ? [desc(canonicalJob.firstSeenAt)]
      : f.sort === "confirmed"
        ? [sql`${canonicalJob.lastVerifiedAt} desc nulls last`]
        : f.sort === "salary"
          ? [sql`${salaryOrder} desc nulls last`]
          : f.q
            ? [desc(sql`ts_rank(${canonicalJob.searchTsv}, websearch_to_tsquery('english', ${f.q}))`), sql`${canonicalJob.lastVerifiedAt} desc nulls last`]
            : [sql`${canonicalJob.lastVerifiedAt} desc nulls last`];

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: canonicalJob.id,
        title: canonicalJob.title,
        employerName: employer.displayName,
        employerIsDemo: employer.isDemo,
        city: canonicalJob.city,
        province: canonicalJob.province,
        remoteType: canonicalJob.remoteType,
        status: canonicalJob.status,
        isDemo: canonicalJob.isDemo,
        postedAt: canonicalJob.postedAt,
        firstSeenAt: canonicalJob.firstSeenAt,
        lastVerifiedAt: canonicalJob.lastVerifiedAt,
        salary: bestSalary,
        sourceCount: sql<number>`(select count(*)::int from ${jobSourceRecord} r where r.canonical_job_id = ${canonicalJob.id} and r.expired_at is null)`,
      })
      .from(canonicalJob)
      .innerJoin(employer, eq(employer.id, canonicalJob.employerId))
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(canonicalJob)
      .innerJoin(employer, eq(employer.id, canonicalJob.employerId))
      .where(where),
  ]);
  const total = totalRows[0]!.n;

  return {
    rows: rows.map((r) => ({
      ...r,
      salaryMin: r.salary?.min != null ? Number(r.salary.min) : null,
      salaryMax: r.salary?.max != null ? Number(r.salary.max) : null,
      salaryPeriod: r.salary?.period ?? null,
    })),
    total,
    page: f.page,
    pageSize: PAGE_SIZE,
  };
}
