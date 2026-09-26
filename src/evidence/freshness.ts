import { and, eq, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, jobSourceRecord, source } from "@/db/schema";
import type { JobSource, LiveStatus } from "@/sources/types";

const HOUR = 3_600_000;

/** Recheck cadence by posting age: < 7 days old every 12 h, otherwise daily. */
export function recheckIntervalMs(firstSeenAt: Date, now: Date): number {
  return now.getTime() - firstSeenAt.getTime() < 7 * 24 * HOUR ? 12 * HOUR : 24 * HOUR;
}

async function applyLiveStatus(db: DB, recordId: string, live: LiveStatus): Promise<void> {
  if (live.state === "LIVE") {
    await db
      .update(jobSourceRecord)
      .set({ lastVerifiedAt: live.checkedAt, lastSeenAt: live.checkedAt, expiredAt: null })
      .where(eq(jobSourceRecord.id, recordId));
  } else if (live.state === "GONE") {
    await db.update(jobSourceRecord).set({ expiredAt: live.checkedAt }).where(eq(jobSourceRecord.id, recordId));
  }
  // UNKNOWN: we couldn't check. Change nothing — never guess.
}

/**
 * Roll per-source freshness up to canonical jobs:
 *   last_verified_at = latest confirmation from any source
 *   expired_at       = set only when every source record has expired
 */
export async function rollupFreshness(db: DB, jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  await db.execute(sql`
    update canonical_job j set
      last_verified_at = agg.last_verified,
      last_seen_at = greatest(j.last_seen_at, agg.last_seen),
      expired_at = case when agg.active = 0 then coalesce(j.expired_at, agg.last_expired) else null end
    from (
      select canonical_job_id,
             max(last_verified_at) as last_verified,
             max(last_seen_at) as last_seen,
             max(expired_at) as last_expired,
             count(*) filter (where expired_at is null) as active
      from job_source_record
      where canonical_job_id in (${sql.join(jobIds.map((id) => sql`${id}::uuid`), sql`, `)})
      group by canonical_job_id
    ) agg
    where j.id = agg.canonical_job_id
  `);
}

/**
 * After a complete fetch of an employer-owned board: postings we hold that
 * weren't in the fetch get an explicit checkLive (we don't assume they're gone).
 * Returns affected canonical job ids.
 */
export async function recheckMissing(db: DB, src: JobSource, sourceId: string, seenRefs: string[]): Promise<string[]> {
  const missing = await db
    .select({ id: jobSourceRecord.id, ref: jobSourceRecord.externalRef, jobId: jobSourceRecord.canonicalJobId })
    .from(jobSourceRecord)
    .where(
      and(
        eq(jobSourceRecord.sourceId, sourceId),
        isNull(jobSourceRecord.expiredAt),
        seenRefs.length ? notInArray(jobSourceRecord.externalRef, seenRefs) : undefined,
      ),
    );
  for (const m of missing) await applyLiveStatus(db, m.id, await src.checkLive(m.ref));
  return [...new Set(missing.map((m) => m.jobId))];
}

/**
 * Scheduled rechecks (brief §9). Checks every active record whose last
 * confirmation is older than its interval. Returns affected canonical job ids.
 */
export async function recheckDue(db: DB, sources: JobSource[], now: Date, limit = 500): Promise<string[]> {
  const byKey = new Map(sources.map((s) => [s.descriptor.key, s]));
  const candidates = await db
    .select({
      id: jobSourceRecord.id,
      ref: jobSourceRecord.externalRef,
      jobId: jobSourceRecord.canonicalJobId,
      firstSeenAt: jobSourceRecord.firstSeenAt,
      lastVerifiedAt: jobSourceRecord.lastVerifiedAt,
      sourceKey: source.key,
    })
    .from(jobSourceRecord)
    .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
    .where(
      and(
        isNull(jobSourceRecord.expiredAt),
        eq(source.enabled, true),
        inArray(source.key, [...byKey.keys()]),
        or(isNull(jobSourceRecord.lastVerifiedAt), lt(jobSourceRecord.lastVerifiedAt, new Date(now.getTime() - 12 * HOUR))),
      ),
    )
    .orderBy(sql`${jobSourceRecord.lastVerifiedAt} asc nulls first`)
    .limit(limit);

  const touched = new Set<string>();
  for (const c of candidates) {
    const due = !c.lastVerifiedAt || now.getTime() - c.lastVerifiedAt.getTime() >= recheckIntervalMs(c.firstSeenAt, now);
    if (!due) continue;
    const src = byKey.get(c.sourceKey)!;
    const live = await src.checkLive(c.ref);
    if (live.state !== "UNKNOWN") touched.add(c.jobId);
    await applyLiveStatus(db, c.id, live);
  }
  const ids = [...touched];
  await rollupFreshness(db, ids);
  return ids;
}

/** Jobs whose status depends on elapsed time (72 h / 14 d windows) need periodic re-verification. */
export async function jobsNeedingTimeBasedReverify(db: DB, now: Date): Promise<string[]> {
  const rows = await db
    .select({ id: canonicalJob.id })
    .from(canonicalJob)
    .where(and(isNull(canonicalJob.expiredAt), or(isNull(canonicalJob.verifiedAt), lt(canonicalJob.verifiedAt, new Date(now.getTime() - 6 * HOUR)))));
  return rows.map((r) => r.id);
}
