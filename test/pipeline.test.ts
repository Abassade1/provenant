import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PgTable } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { canonicalJob, employer, ingestionError, ingestionRun, jobSourceRecord, rawPosting, source } from "@/db/schema";
import { clearRobotsCache } from "@/lib/http";
import { ingestAll } from "@/pipeline/ingest-all";
import { MAX_RETRIES, runSource } from "@/pipeline/run";
import { createDemoSources } from "@/sources/demo";
import { buildDemoJobs } from "@/sources/demo/data";
import type { JobSource } from "@/sources/types";
import { resetDb } from "./db";
import { fakeGreenhouse, makeSource } from "./greenhouse-fake";

const opts = { backoffMs: () => 0 };
const count = async (table: PgTable) =>
  (await getDb().select({ n: sql<number>`count(*)::int` }).from(table))[0]!.n;

beforeEach(async () => {
  clearRobotsCache();
  await resetDb();
});
afterAll(async () => closeDb());

describe("pipeline: demo connector", () => {
  const liveDemoJobs = buildDemoJobs().filter((j) => j.postedDaysAgo <= 25).length;

  it("ingests every live demo job, all flagged as demo on .example domains", async () => {
    const results = await ingestAll(getDb(), createDemoSources(), opts);
    expect(results.every((r) => r.status === "SUCCEEDED")).toBe(true);
    const onBoards = await getDb()
      .select({ n: sql<number>`count(distinct ${jobSourceRecord.canonicalJobId})::int` })
      .from(jobSourceRecord)
      .innerJoin(source, eq(source.id, jobSourceRecord.sourceId))
      .where(eq(source.employerOwned, true));
    expect(onBoards[0]!.n).toBe(liveDemoJobs);
    expect(await getDb().select().from(canonicalJob).where(eq(canonicalJob.isDemo, false))).toHaveLength(0);
    const emps = await getDb().select().from(employer);
    expect(emps.every((e) => e.isDemo && (!e.primaryDomain || e.primaryDomain.endsWith(".example")))).toBe(true);
  });

  it("is idempotent across runs", async () => {
    await ingestAll(getDb(), createDemoSources(), opts);
    const snapshot = async () => ({
      jobs: (await getDb().select({ id: canonicalJob.id, status: canonicalJob.status }).from(canonicalJob)).sort((a, b) => a.id.localeCompare(b.id)),
      records: await count(jobSourceRecord),
      raws: await count(rawPosting),
    });
    const before = await snapshot();
    await ingestAll(getDb(), createDemoSources(), opts);
    expect(await snapshot()).toEqual(before);
  });
});

describe("pipeline: Greenhouse connector", () => {
  it("upserts Canadian postings, skips non-Canadian ones, dead-letters malformed ones", async () => {
    const result = await runSource(getDb(), makeSource(fakeGreenhouse().fetchImpl), opts);
    expect(result).toMatchObject({ status: "PARTIAL", fetched: 4, upserted: 2, skipped: 1, errored: 1 });

    const jobs = await getDb().select().from(canonicalJob).orderBy(canonicalJob.title);
    expect(jobs.map((j) => [j.title, j.city, j.province, j.remoteType, j.employmentType])).toEqual([
      ["Customer Success Manager", null, null, "REMOTE", "UNKNOWN"],
      ["Sr. Software Engineer, Platform (Hybrid)", "Toronto", "ON", "HYBRID", "FULL_TIME"],
    ]);
    // On the employer's board and just confirmed, but no careers-page link configured → identity PROBABLE.
    expect(jobs.every((j) => !j.isDemo && j.status === "PARTIALLY_VERIFIED")).toBe(true);

    const errors = await getDb().select().from(ingestionError);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ stage: "VALIDATE", retryCount: 0 });
    expect(errors[0]!.deadLetteredAt).not.toBeNull();
    // Errors reference the raw posting, never embed its content.
    expect(errors[0]!.payloadRef).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("retries a failing fetch with backoff and succeeds", async () => {
    const delays: number[] = [];
    const result = await runSource(getDb(), makeSource(fakeGreenhouse({ failTimes: 2 }).fetchImpl), {
      backoffMs: (n) => (delays.push(n), 0),
    });
    expect(result.status).toBe("PARTIAL"); // the malformed fixture posting still dead-letters
    expect(delays).toEqual([1, 2]);
    const fetchErrors = await getDb().select().from(ingestionError).where(eq(ingestionError.stage, "FETCH"));
    expect(fetchErrors.map((e) => [e.retryCount, e.deadLetteredAt])).toEqual([
      [0, null],
      [1, null],
    ]);
  });

  it("dead-letters the run after max retries", async () => {
    const result = await runSource(getDb(), makeSource(fakeGreenhouse({ failTimes: 99 }).fetchImpl), opts);
    expect(result.status).toBe("FAILED");
    const [run] = await getDb().select().from(ingestionRun);
    expect(run!.status).toBe("FAILED");
    const dead = await getDb()
      .select()
      .from(ingestionError)
      .where(sql`${ingestionError.deadLetteredAt} is not null`);
    expect(dead).toHaveLength(1);
    expect(dead[0]!.retryCount).toBe(MAX_RETRIES);
    expect(await count(canonicalJob)).toBe(0);
  });

  it("retries transient per-posting failures, then dead-letters", async () => {
    const demo = createDemoSources()[0];
    let calls = 0;
    const flaky: JobSource = {
      descriptor: demo!.descriptor,
      fetch: (c) => demo!.fetch(c).then((p) => ({ ...p, postings: p.postings.slice(0, 1) })),
      parse: () => {
        calls++;
        throw new Error("transient parser failure");
      },
      checkLive: (r) => demo!.checkLive(r),
    };
    const result = await runSource(getDb(), flaky, opts);
    expect(result).toMatchObject({ status: "FAILED", errored: 1, upserted: 0 });
    expect(calls).toBe(MAX_RETRIES + 1);
    const errs = await getDb().select().from(ingestionError).orderBy(ingestionError.retryCount);
    expect(errs.map((e) => e.retryCount)).toEqual([0, 1, 2, 3]);
    expect(errs.filter((e) => e.deadLetteredAt)).toHaveLength(1);
  });
});

describe("search index", () => {
  it("maintains search_tsv via trigger", async () => {
    await runSource(getDb(), makeSource(fakeGreenhouse().fetchImpl), opts);
    const hits = await getDb()
      .select({ title: canonicalJob.title })
      .from(canonicalJob)
      .where(sql`${canonicalJob.searchTsv} @@ plainto_tsquery('english', 'postgresql toronto')`);
    expect(hits.map((h) => h.title)).toEqual(["Sr. Software Engineer, Platform (Hybrid)"]);
  });
});
