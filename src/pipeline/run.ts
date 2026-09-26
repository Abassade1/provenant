import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ingestionError, ingestionRun, rawPosting, source } from "@/db/schema";
import type { JobSource, RawPosting, SourceDescriptor } from "@/sources/types";
import { deduplicate } from "./stages/deduplicate";
import { normalize } from "./stages/normalize";
import { resolveEmployer } from "./stages/resolve-employer";
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
 * Fetch → Parse → Normalize → Validate → Resolve employer → Deduplicate →
 * Extract salary → Verify → Upsert → Index, for every posting from one source.
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
        else counts.upserted++;
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
): Promise<"upserted" | "skipped"> {
  const parsed = await stage("PARSE", () => src.parse(raw));
  const normalized = await stage("NORMALIZE", () => normalize(parsed));
  const v = await stage("VALIDATE", () => validate(normalized));
  if (!v.ok) {
    if (v.skip) return "skipped";
    throw new StageError("VALIDATE", new PermanentError(v.reason));
  }
  const employerId = await stage("RESOLVE_EMPLOYER", () => resolveEmployer(db, src.descriptor, v.posting));
  const dedupe = await stage("DEDUPLICATE", () => deduplicate(db, sourceId, v.posting.externalRef));
  // EXTRACT_SALARY and VERIFY are Phase 3 stages; they slot in here.
  await stage("UPSERT", () =>
    upsertJob(db, {
      sourceId,
      rawPostingId,
      employerId,
      canonicalJobId: dedupe.canonicalJobId,
      posting: v.posting,
      isDemo: src.descriptor.isDemo,
      now,
    }),
  );
  // INDEX: canonical_job.search_tsv is maintained by a trigger (drizzle/0002_search_tsv.sql).
  return "upserted";
}

/** Postings that exhausted their retries and wait for an admin. */
export async function openDeadLetters(db: DB) {
  return db
    .select()
    .from(ingestionError)
    .where(and(sql`${ingestionError.deadLetteredAt} is not null`, sql`${ingestionError.resolvedAt} is null`));
}
