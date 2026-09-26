import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, ingestionError, ingestionRun, rawPosting, source } from "@/db/schema";
import { recheckMissing, rollupFreshness } from "@/evidence/freshness";
import { knownDomains, verifyJob } from "@/evidence/verify-job";
import type { JobSource, RawPosting, SourceDescriptor } from "@/sources/types";
import { deduplicate } from "./stages/deduplicate";
import { extractEvidence } from "./stages/extract";
import { normalize } from "./stages/normalize";
import { resolveEmployer, resolveSourceEmployer } from "./stages/resolve-employer";
import { upsertJob } from "./stages/upsert";
import { validate } from "./stages/validate";

export type Stage = (typeof ingestionError.stage.enumValues)[number];

export const MAX_RETRIES = 3;

/** An error that retrying won't fix (malformed data). Dead-lettered on first failure. */
export class PermanentError extends Error {
  override name = "PermanentError";
}

export class StageError extends Error {
  constructor(
    public readonly stage: Stage,
    public override readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "StageError";
  }
  get permanent() {
    return this.cause instanceof PermanentError || (this.cause as Error)?.name === "ZodError";
  }
}

async function stage<T>(name: Stage, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw e instanceof StageError ? e : new StageError(name, e);
  }
}

export interface RunOptions {
  now?: () => Date;
  /** Delay before retry n (1-based). Exponential by default; tests pass () => 0. */
  backoffMs?: (attempt: number) => number;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}

export interface RunResult {
  runId: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  fetched: number;
  upserted: number;
  skipped: number;
  errored: number;
}

const defaultBackoff = (attempt: number) => 500 * 2 ** (attempt - 1); // 0.5s, 1s, 2s
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export async function ensureSource(db: DB, d: SourceDescriptor): Promise<string> {
  const values = {
    key: d.key,
    type: d.type,
    provider: d.provider,
    name: d.name,
    boardToken: d.boardToken ?? null,
    termsReference: d.termsReference,
    allowedUse: d.allowedUse,
    rateLimitPerMin: d.rateLimitPerMin,
    isDemo: d.isDemo,
    employerOwned: d.employerOwned,
  };
  const [row] = await db
    .insert(source)
    .values(values)
    .onConflictDoUpdate({ target: source.key, set: { ...values, updatedAt: new Date() } })
    .returning({ id: source.id });
  return row!.id;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Fetch → Parse → Normalize → Validate → Resolve employer → Extract salary →
 * Deduplicate → Upsert → Index, for every posting from one source; then
 * freshness rollup and Verify for every job the run touched.
 *
 * (Salary is extracted before dedupe because salary overlap is a dedupe
 * feature; Verify runs last because it needs the merged, persisted job.)
 */
export async function runSource(db: DB, src: JobSource, opts: RunOptions = {}): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const backoff = opts.backoffMs ?? defaultBackoff;
  const log = opts.log ?? (() => {});
  const d = src.descriptor;

  const sourceId = await ensureSource(db, d);
  const [run] = await db.insert(ingestionRun).values({ sourceId }).returning({ id: ingestionRun.id });
  const runId = run!.id;
  const counts = { fetched: 0, upserted: 0, skipped: 0, errored: 0 };

  const recordError = (s: Stage, message: string, payloadRef: string | null, retryCount: number, dead: boolean) =>
    db.insert(ingestionError).values({
      runId,
      sourceId,
      stage: s,
      payloadRef,
      message: message.slice(0, 2000),
      retryCount,
      deadLetteredAt: dead ? now() : null,
    });

  // ── FETCH (with retries) ────────────────────────────────────────────────
  const postings: RawPosting[] = [];
  let cursor: string | null = null;
  try {
    do {
      let attempt = 0;
      for (;;) {
        try {
          const page = await src.fetch(cursor);
          postings.push(...page.postings);
          cursor = page.nextCursor;
          break;
        } catch (e) {
          attempt++;
          const msg = (e as Error).message;
          if (attempt > MAX_RETRIES) throw e;
          await recordError("FETCH", msg, cursor, attempt - 1, false);
          log("fetch failed, retrying", { source: d.key, attempt, msg });
          await sleep(backoff(attempt));
        }
      }
    } while (cursor);
  } catch (e) {
    await recordError("FETCH", (e as Error).message, cursor, MAX_RETRIES, true);
    await db
      .update(ingestionRun)
      .set({ status: "FAILED", finishedAt: now(), errored: 1 })
      .where(eq(ingestionRun.id, runId));
    log("fetch dead-lettered", { source: d.key });
    return { runId, status: "FAILED", ...counts, errored: 1 };
  }
  counts.fetched = postings.length;

  // ── RESOLVE_EMPLOYER (source level): identity from the careers-page probe ─
  let sourceEmployer: Awaited<ReturnType<typeof resolveSourceEmployer>> = null;
  try {
    sourceEmployer = await resolveSourceEmployer(db, src, sourceId, now());
  } catch (e) {
    await recordError("RESOLVE_EMPLOYER", (e as Error).message, null, 0, false);
  }
  const touched = new Set<string>();

  // ── Per-posting stages ──────────────────────────────────────────────────
  for (const raw of postings) {
    const contentHash = hashPayload(raw.payload);
    await db
      .insert(rawPosting)
      .values({ sourceId, externalRef: raw.externalRef, payload: raw.payload, contentHash, isDemo: d.isDemo })
      .onConflictDoUpdate({
        target: [rawPosting.sourceId, rawPosting.externalRef, rawPosting.contentHash],
        set: { fetchedAt: now() },
      });
    const [rawRow] = await db
      .select({ id: rawPosting.id })
      .from(rawPosting)
      .where(
        and(
          eq(rawPosting.sourceId, sourceId),
          eq(rawPosting.externalRef, raw.externalRef),
          eq(rawPosting.contentHash, contentHash),
        ),
      );
    const rawPostingId = rawRow!.id;

    for (let attempt = 0; ; attempt++) {
      try {
        const outcome = await processPosting(db, src, sourceId, rawPostingId, raw, now());
        if (outcome === "skipped") counts.skipped++;
        else {
          counts.upserted++;
          touched.add(outcome.jobId);
          for (const id of outcome.relatedJobIds) touched.add(id);
        }
        break;
      } catch (e) {
        const err = e instanceof StageError ? e : new StageError("UPSERT", e);
        const dead = err.permanent || attempt + 1 > MAX_RETRIES;
        await recordError(err.stage, err.message, rawPostingId, attempt, dead);
        if (dead) {
          counts.errored++;
          log("posting dead-lettered", { source: d.key, ref: raw.externalRef, stage: err.stage });
          break;
        }
        await sleep(backoff(attempt + 1));
      }
    }
  }

  // ── Freshness: employer boards list every open job, so check what vanished ─
  if (d.employerOwned) {
    try {
      for (const id of await recheckMissing(db, src, sourceId, postings.map((p) => p.externalRef))) touched.add(id);
    } catch (e) {
      await recordError("VERIFY", `freshness recheck failed: ${(e as Error).message}`, null, 0, false);
    }
  }
  // Identity changes affect every job of this employer.
  if (sourceEmployer?.identityChanged) {
    const jobs = await db.select({ id: canonicalJob.id }).from(canonicalJob).where(eq(canonicalJob.employerId, sourceEmployer.employerId));
    for (const j of jobs) touched.add(j.id);
  }

  // ── VERIFY every touched job ─────────────────────────────────────────────
  const ids = [...touched];
  await rollupFreshness(db, ids);
  const domains = await knownDomains(db);
  for (const id of ids) {
    try {
      await verifyJob(db, id, now(), domains);
    } catch (e) {
      await recordError("VERIFY", (e as Error).message, id, 0, false);
      log("verify failed", { job: id });
    }
  }

  const status: RunResult["status"] = counts.errored === 0 ? "SUCCEEDED" : counts.upserted > 0 ? "PARTIAL" : "FAILED";
  await db
    .update(ingestionRun)
    .set({ status, finishedAt: now(), ...counts })
    .where(eq(ingestionRun.id, runId));
  if (status !== "FAILED") {
    await db.update(source).set({ lastSuccessAt: now() }).where(eq(source.id, sourceId));
  }
  log("run finished", { source: d.key, status, ...counts });
  return { runId, status, ...counts };
}

async function processPosting(
  db: DB,
  src: JobSource,
  sourceId: string,
  rawPostingId: string,
  raw: RawPosting,
  now: Date,
): Promise<{ jobId: string; relatedJobIds: string[] } | "skipped"> {
  const d = src.descriptor;
  const parsed = await stage("PARSE", () => src.parse(raw));
  const normalized = await stage("NORMALIZE", () => normalize(parsed));
  const v = await stage("VALIDATE", () => validate(normalized));
  if (!v.ok) {
    if (v.skip) return "skipped";
    throw new StageError("VALIDATE", new PermanentError(v.reason));
  }
  const employerId = await stage("RESOLVE_EMPLOYER", () => resolveEmployer(db, d, v.posting));
  const evidence = await stage("EXTRACT_SALARY", () => extractEvidence(parsed, v.posting));
  const decision = await stage("DEDUPLICATE", () =>
    deduplicate(db, {
      sourceId,
      employerOwned: d.employerOwned,
      employerId,
      posting: v.posting,
      salary: evidence.salary,
      skills: evidence.skills,
    }),
  );
  const jobId = await stage("UPSERT", () =>
    upsertJob(db, {
      sourceId,
      employerOwned: d.employerOwned,
      rawPostingId,
      employerId,
      decision,
      posting: v.posting,
      evidence,
      isDemo: d.isDemo,
      now,
    }),
  );
  // INDEX: canonical_job.search_tsv is maintained by a trigger (drizzle/0002_search_tsv.sql).
  // A REVIEW/MERGE decision can change an *existing* job's duplicate-cluster
  // membership too (via upsertJob) — that job needs re-verifying alongside this one.
  const relatedJobIds = decision.kind === "REVIEW" ? [decision.reviewWith] : decision.kind === "MERGE" ? [decision.canonicalJobId] : [];
  return { jobId, relatedJobIds };
}

/** Postings that exhausted their retries and wait for an admin. */
export async function openDeadLetters(db: DB) {
  return db
    .select()
    .from(ingestionError)
    .where(and(sql`${ingestionError.deadLetteredAt} is not null`, sql`${ingestionError.resolvedAt} is null`));
}
