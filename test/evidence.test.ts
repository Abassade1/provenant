import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import {
  canonicalJob,
  duplicateCluster,
  employer,
  jobSourceRecord,
  salaryEvidence,
  verificationSignal,
  verificationStatusHistory,
} from "@/db/schema";
import { recheckDue } from "@/evidence/freshness";
import { currentSignals, verifyJob } from "@/evidence/verify-job";
import { clearRobotsCache } from "@/lib/http";
import { ingestAll } from "@/pipeline/ingest-all";
import { runSource } from "@/pipeline/run";
import { createDemoSources } from "@/sources/demo";
import { GreenhouseSource } from "@/sources/greenhouse";
import { JobBankSource } from "@/sources/jobbank";
import type { JobSource } from "@/sources/types";
import { resetDb } from "./db";

const H = 3_600_000;
const T0 = new Date("2026-09-26T12:00:00Z");
const at = (hours: number) => () => new Date(T0.getTime() + hours * H);
const opts = (hours = 0) => ({ backoffMs: () => 0, now: at(hours) });
const db = () => getDb();

const board = JSON.parse(readFileSync(new URL("./fixtures/greenhouse-board.json", import.meta.url), "utf8"));
const jobbankRows = JSON.parse(readFileSync(new URL("./fixtures/jobbank.json", import.meta.url), "utf8"));

/** Greenhouse fake with a mutable board, a careers page and per-job liveness. */
function greenhouse(state: { ids: number[]; careersHtml?: string | null; careersStatus?: number }) {
  const fetchImpl = async (url: string) => {
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    if (url.startsWith("https://maplewood.example/careers")) {
      if (state.careersHtml == null) return new Response("", { status: state.careersStatus ?? 503 });
      return new Response(state.careersHtml, { headers: { "content-type": "text/html" } });
    }
    if (url.includes("/jobs?")) {
      return Response.json({ jobs: board.jobs.filter((j: { id: number }) => state.ids.includes(j.id)) });
    }
    const m = /\/jobs\/(\d+)$/.exec(url);
    if (m) return state.ids.includes(Number(m[1])) ? Response.json({}) : new Response("", { status: 404 });
    return new Response("", { status: 404 });
  };
  return new GreenhouseSource({
    boardToken: "maplewoodfixture",
    employer: { name: "Maplewood Analytics", domain: "maplewood.example", careersUrl: "https://maplewood.example/careers" },
    rateLimitPerMin: 1_000_000,
    fetchImpl,
  });
}
const LINKING = `<a href="https://job-boards.greenhouse.io/maplewoodfixture">Open roles</a>`;

const jobByTitle = async (title: string) => (await db().select().from(canonicalJob).where(eq(canonicalJob.title, title)))[0]!;
const signalCodes = async (jobId: string) => (await currentSignals(db(), jobId)).map((s) => s.code);

beforeEach(async () => {
  clearRobotsCache();
  await resetDb();
});
afterAll(async () => closeDb());

// ── Demo scenarios ───────────────────────────────────────────────────────

describe("demo scenarios through the full engine", () => {
  beforeEach(async () => {
    await ingestAll(db(), createDemoSources(at(0)), opts());
  });

  it("confirms identity only where the careers page links the board", async () => {
    const emps = await db().select({ name: employer.displayName, status: employer.identityStatus }).from(employer);
    const by = Object.fromEntries(emps.map((e) => [e.name, e.status]));
    expect(by["Northwind Labs"]).toBe("CONFIRMED");
    expect(by["Prairie Grid Energy"]).toBe("PROBABLE");
    expect(by["Cedarline Foods"]).toBe("PROBABLE");
    expect(by["Aurora Bakery"]).toBe("UNKNOWN");
  });

  it("marks impersonation postings HIGH_RISK with the specific patterns", async () => {
    const clerk = await jobByTitle("Remote Data Entry Clerk");
    expect(clerk.status).toBe("HIGH_RISK");
    expect(await signalCodes(clerk.id)).toEqual(
      expect.arrayContaining(["UPFRONT_PAYMENT_REQUEST", "OFF_PLATFORM_CONTACT", "LOOKALIKE_DOMAIN", "NOT_FOUND_ON_EMPLOYER_SITE"]),
    );
    expect(await signalCodes(clerk.id)).not.toContain("EMPLOYER_IDENTITY_CONFIRMED");
    expect((await jobByTitle("Package Handler")).status).toBe("HIGH_RISK");
  });

  it("one pattern → review; salary conflict → review", async () => {
    expect((await jobByTitle("Medical Receptionist")).status).toBe("REVIEW_REQUIRED");
    const conflicts = await db()
      .select({ id: verificationSignal.subjectId })
      .from(verificationSignal)
      .where(and(eq(verificationSignal.code, "SALARY_CONFLICT"), isNull(verificationSignal.supersededAt)));
    expect(conflicts).toHaveLength(1);
    const [job] = await db().select().from(canonicalJob).where(eq(canonicalJob.id, conflicts[0]!.id));
    expect(job!.status).toBe("REVIEW_REQUIRED");
    // Both salary rows kept, each with its own source and quote.
    const rows = await db().select().from(salaryEvidence).where(eq(salaryEvidence.canonicalJobId, job!.id));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sourceId)).size).toBe(2);
  });

  it("merges reposts into the employer's job and keeps every source record", async () => {
    const merged = await db()
      .select({ id: jobSourceRecord.canonicalJobId, n: sql<number>`count(*)::int` })
      .from(jobSourceRecord)
      .groupBy(jobSourceRecord.canonicalJobId)
      .having(sql`count(*) > 1`);
    expect(merged.length).toBeGreaterThanOrEqual(5);
    const clusters = await db().select().from(duplicateCluster).where(eq(duplicateCluster.status, "AUTO_MERGED"));
    expect(clusters.length).toBe(merged.length);
  });

  it("reposts of jobs the employer removed are UNVERIFIED with NOT_FOUND", async () => {
    const onlyOnAggregator = await db().execute<{ id: string }>(sql`
      select j.id from canonical_job j join employer e on e.id = j.employer_id
      where e.primary_domain is not null
        and not exists (select 1 from job_source_record r join source s on s.id = r.source_id where r.canonical_job_id = j.id and s.employer_owned)
        and j.status = 'UNVERIFIED'`);
    expect(onlyOnAggregator.rows.length).toBeGreaterThanOrEqual(2);
    for (const r of onlyOnAggregator.rows) expect(await signalCodes(r.id)).toContain("NOT_FOUND_ON_EMPLOYER_SITE");
  });

  it("has verified jobs, and re-running supersedes signals instead of duplicating them", async () => {
    const verified = await db().select().from(canonicalJob).where(eq(canonicalJob.status, "VERIFIED"));
    expect(verified.length).toBeGreaterThan(10);
    const id = verified[0]!.id;
    const before = (await signalCodes(id)).length;
    await ingestAll(db(), createDemoSources(at(1)), opts(1));
    expect((await signalCodes(id)).length).toBe(before);
    const history = await db().select().from(verificationStatusHistory).where(eq(verificationStatusHistory.canonicalJobId, id));
    expect(history).toHaveLength(1); // unchanged status → no new history row
  });

  it("VERIFIED decays to PARTIALLY_VERIFIED after 72 h without confirmation, then STALE after 14 days", async () => {
    const [v] = await db().select().from(canonicalJob).where(eq(canonicalJob.status, "VERIFIED")).limit(1);
    expect((await verifyJob(db(), v!.id, at(73)()))!.status).toBe("PARTIALLY_VERIFIED");
    expect((await verifyJob(db(), v!.id, at(15 * 24)()))!.status).toBe("STALE");
    const history = await db().select().from(verificationStatusHistory).where(eq(verificationStatusHistory.canonicalJobId, v!.id));
    expect(history.map((h) => h.toStatus)).toEqual(["VERIFIED", "PARTIALLY_VERIFIED", "STALE"]);
  });

  it("admin override wins (R0) and is recorded as such", async () => {
    const clerk = await jobByTitle("Remote Data Entry Clerk");
    await db().update(canonicalJob).set({ overrideStatus: "UNVERIFIED", overrideAt: T0, overrideNote: "test" }).where(eq(canonicalJob.id, clerk.id));
    const r = await verifyJob(db(), clerk.id, T0);
    expect(r).toMatchObject({ status: "UNVERIFIED", ruleId: "R0" });
    const [last] = await db()
      .select()
      .from(verificationStatusHistory)
      .where(eq(verificationStatusHistory.canonicalJobId, clerk.id))
      .orderBy(sql`${verificationStatusHistory.createdAt} desc`)
      .limit(1);
    expect(last!.reason).toBe("ADMIN_OVERRIDE");
  });
});

// ── Cross-source dedupe with real connectors ─────────────────────────────

describe("dedupe across Greenhouse and Job Bank", () => {
  it("merges the same job, keeps the other city separate, and agrees across sources", async () => {
    await runSource(db(), greenhouse({ ids: [4000001, 4000002], careersHtml: LINKING }), opts());
    await runSource(db(), new JobBankSource(async () => jobbankRows), opts());

    const toronto = await jobByTitle("Sr. Software Engineer, Platform (Hybrid)");
    const recs = await db().select().from(jobSourceRecord).where(eq(jobSourceRecord.canonicalJobId, toronto.id));
    expect(recs).toHaveLength(2);
    expect(toronto.status).toBe("VERIFIED");
    expect(await signalCodes(toronto.id)).toEqual(expect.arrayContaining(["CONSISTENT_ACROSS_SOURCES", "SALARY_STATED_BY_EMPLOYER", "VACANCY_STATUS_DISCLOSED"]));
    // Canonical fields still come from the employer's own posting.
    expect(toronto.applyUrl).toContain("greenhouse.io");

    const ottawa = await db().select().from(canonicalJob).where(eq(canonicalJob.city, "Ottawa"));
    expect(ottawa).toHaveLength(1);
    expect(ottawa[0]!.id).not.toBe(toronto.id);
    expect(ottawa[0]!.status).toBe("UNVERIFIED"); // employer's board doesn't list an Ottawa role
    expect(await signalCodes(ottawa[0]!.id)).toContain("NOT_FOUND_ON_EMPLOYER_SITE");
  });

  it("never merges a scam-pattern repost into a real job, however similar", async () => {
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: LINKING }), opts());
    const original = board.jobs[0];
    const imposter: JobSource = {
      descriptor: {
        key: "test:imposter-board", type: "USER_SUBMITTED_CHECK", provider: "test", name: "Imposter board",
        termsReference: "test", allowedUse: "test", rateLimitPerMin: 1000, isDemo: false, employerOwned: false,
      },
      fetch: async () => ({ postings: [{ externalRef: "x1", payload: {} }], nextCursor: null }),
      parse: () => ({
        externalRef: "x1",
        title: original.title,
        employerName: "Maplewood Analytics",
        locationText: "Toronto, ON",
        employmentTypeText: "Full-time",
        workplaceTypeText: "Hybrid",
        descriptionText: "We build forecasting tools for Canadian grocers. TypeScript & Go. PostgreSQL. Contact our recruiter on WhatsApp to continue.",
        url: "https://imposter.example/x1",
        applyUrl: "https://maplewood-careers.example/apply",
        postedAt: null,
        salary: null,
      }),
      checkLive: async () => ({ state: "UNKNOWN", checkedAt: T0, detail: "" }),
    };
    await runSource(db(), imposter, opts());
    const jobs = await db().select().from(canonicalJob);
    expect(jobs).toHaveLength(2);
    const fake = jobs.find((j) => j.applyUrl.includes("maplewood-careers"))!;
    expect(fake.status).toBe("HIGH_RISK");
    const real = jobs.find((j) => j.id !== fake.id)!;
    expect(real.status).toBe("REVIEW_REQUIRED"); // open duplicate cluster awaits a human
    const [cluster] = await db().select().from(duplicateCluster);
    expect(cluster!.status).toBe("REVIEW_REQUIRED");
    expect(JSON.stringify(cluster!.features)).toMatch(/scam patterns|apply link/);
  });
});

// ── Identity ─────────────────────────────────────────────────────────────

describe("employer identity", () => {
  const status = async () => (await db().select().from(employer))[0]!.identityStatus;

  it("CONFIRMED when the careers page links the board; PROBABLE when it doesn't", async () => {
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: LINKING }), opts());
    expect(await status()).toBe("CONFIRMED");
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: "<p>No links here</p>" }), opts(25));
    expect(await status()).toBe("PROBABLE");
  });

  it("keeps CONFIRMED through a failed check within 30 days, then downgrades", async () => {
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: LINKING }), opts());
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: null }), opts(25));
    expect(await status()).toBe("CONFIRMED");
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: null }), opts(31 * 24));
    expect(await status()).toBe("PROBABLE");
  });

  it("doesn't re-probe within 24 hours", async () => {
    const state = { ids: [4000001], careersHtml: LINKING as string | null };
    await runSource(db(), greenhouse(state), opts());
    state.careersHtml = "<p>gone</p>";
    await runSource(db(), greenhouse(state), opts(2));
    expect(await status()).toBe("CONFIRMED");
  });
});

// ── Freshness ────────────────────────────────────────────────────────────

describe("freshness", () => {
  it("a posting that disappears from the board is rechecked and expires", async () => {
    const state = { ids: [4000001, 4000002], careersHtml: LINKING };
    await runSource(db(), greenhouse(state), opts());
    state.ids = [4000002];
    await runSource(db(), greenhouse(state), opts(12));
    const job = await jobByTitle("Sr. Software Engineer, Platform (Hybrid)");
    expect(job.expiredAt).not.toBeNull();
    expect(job.status).toBe("EXPIRED");
  });

  it("scheduled rechecks confirm LIVE, expire GONE, and leave UNKNOWN alone", async () => {
    const state = { ids: [4000001, 4000002], careersHtml: LINKING };
    const gh = greenhouse(state);
    await runSource(db(), gh, opts());
    await runSource(db(), new JobBankSource(async () => jobbankRows), opts());

    state.ids = [4000001]; // 4000002 closes
    const touched = await recheckDue(db(), [gh, new JobBankSource(async () => jobbankRows)], at(13)());
    expect(touched).toHaveLength(2);

    // checkLive's own checkedAt is real wall-clock time (it's what actually happened), not the fake test clock.
    const live = await jobByTitle("Sr. Software Engineer, Platform (Hybrid)");
    expect(live.lastVerifiedAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(live.expiredAt).toBeNull(); // Job Bank's UNKNOWN didn't expire the merged job
    const gone = await jobByTitle("Customer Success Manager");
    expect(gone.expiredAt).not.toBeNull();
  });

  it("respects the cadence: nothing is due before 12 h", async () => {
    await runSource(db(), greenhouse({ ids: [4000001], careersHtml: LINKING }), opts());
    expect(await recheckDue(db(), [greenhouse({ ids: [4000001] })], at(6)())).toHaveLength(0);
  });
});
