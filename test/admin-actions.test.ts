import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { adminAuditLog, canonicalJob, duplicateCluster, ingestionError, jobReport, jobSourceRecord } from "@/db/schema";
import { ingestAll } from "@/pipeline/ingest-all";
import { createDemoSources } from "@/sources/demo";
import { resetDb } from "./db";

const db = () => getDb();
const opts = { backoffMs: () => 0 };

// These actions call requireAdmin(), which in this test env (NODE_ENV !== "production")
// honours ADMIN_DEV_OPEN — the same bypass the admin pages use in dev.
process.env.ADMIN_DEV_OPEN = "true";

beforeEach(async () => {
  await resetDb();
  await ingestAll(db(), createDemoSources(), opts);
});
afterAll(async () => closeDb());

describe("overrideJobStatus", () => {
  it("sets, records, and clears an override, each time re-verifying and auditing", async () => {
    const { overrideJobStatus } = await import("@/app/actions/admin");
    const [job] = await db().select().from(canonicalJob).limit(1);

    const set = await overrideJobStatus(job!.id, "UNVERIFIED", "manual check");
    expect(set).toEqual({ ok: true });
    const [after] = await db().select().from(canonicalJob).where(eq(canonicalJob.id, job!.id));
    expect(after!.status).toBe("UNVERIFIED");
    expect(after!.statusRule).toBe("R0");
    expect(after!.overrideNote).toBe("manual check");

    const audits = await db().select().from(adminAuditLog).where(eq(adminAuditLog.entityId, job!.id));
    expect(audits.map((a) => a.action)).toEqual(["SET_OVERRIDE"]);

    const cleared = await overrideJobStatus(job!.id, "CLEAR", "");
    expect(cleared).toEqual({ ok: true });
    const [restored] = await db().select().from(canonicalJob).where(eq(canonicalJob.id, job!.id));
    expect(restored!.overrideStatus).toBeNull();
    expect(restored!.status).not.toBe("R0"); // re-verified back to a rule-derived status
  });

  it("rejects an invalid status", async () => {
    const { overrideJobStatus } = await import("@/app/actions/admin");
    const [job] = await db().select().from(canonicalJob).limit(1);
    const r = await overrideJobStatus(job!.id, "NOT_A_STATUS" as never, "");
    expect(r).toMatchObject({ error: expect.any(String) });
  });
});

describe("cluster resolution", () => {
  it("merging moves the losing job's source records and expires it", async () => {
    const { mergeCluster } = await import("@/app/actions/admin");
    const [cluster] = await db().select().from(duplicateCluster).where(eq(duplicateCluster.status, "REVIEW_REQUIRED")).limit(1);
    const recs = await db().select().from(jobSourceRecord).where(eq(jobSourceRecord.duplicateClusterId, cluster!.id));
    const jobIds = [...new Set(recs.map((r) => r.canonicalJobId))];
    expect(jobIds.length).toBeGreaterThanOrEqual(2);
    const [keep, drop] = jobIds;

    const r = await mergeCluster(cluster!.id, keep!, drop!);
    expect(r).toEqual({ ok: true });

    const dropRecs = await db().select().from(jobSourceRecord).where(eq(jobSourceRecord.canonicalJobId, drop!));
    expect(dropRecs).toHaveLength(0);
    const [droppedJob] = await db().select().from(canonicalJob).where(eq(canonicalJob.id, drop!));
    expect(droppedJob!.expiredAt).not.toBeNull();
    const [resolvedCluster] = await db().select().from(duplicateCluster).where(eq(duplicateCluster.id, cluster!.id));
    expect(resolvedCluster!.status).toBe("RESOLVED");

    const audits = await db().select().from(adminAuditLog).where(eq(adminAuditLog.entity, "duplicate_cluster"));
    expect(audits.map((a) => a.action)).toContain("MERGE_DUPLICATE");
  });

  it("keeping separate detaches both jobs from the cluster without expiring either", async () => {
    const { keepClusterSeparate } = await import("@/app/actions/admin");
    const [cluster] = await db().select().from(duplicateCluster).where(eq(duplicateCluster.status, "REVIEW_REQUIRED")).limit(1);
    const before = await db().select().from(jobSourceRecord).where(eq(jobSourceRecord.duplicateClusterId, cluster!.id));
    const jobIds = [...new Set(before.map((r) => r.canonicalJobId))];

    const r = await keepClusterSeparate(cluster!.id);
    expect(r).toEqual({ ok: true });

    const [resolved] = await db().select().from(duplicateCluster).where(eq(duplicateCluster.id, cluster!.id));
    expect(resolved!.status).toBe("RESOLVED");
    for (const id of jobIds) {
      const [job] = await db().select().from(canonicalJob).where(eq(canonicalJob.id, id));
      expect(job!.expiredAt).toBeNull();
    }
    const remaining = await db().select().from(jobSourceRecord).where(eq(jobSourceRecord.duplicateClusterId, cluster!.id));
    expect(remaining).toHaveLength(0);
  });

  it("refuses to act on a cluster that isn't pending review", async () => {
    const { mergeCluster, keepClusterSeparate } = await import("@/app/actions/admin");
    const [merged] = await db().select().from(duplicateCluster).where(eq(duplicateCluster.status, "AUTO_MERGED")).limit(1);
    expect(await keepClusterSeparate(merged!.id)).toMatchObject({ error: expect.any(String) });
    expect(await mergeCluster(merged!.id, "x", "y")).toMatchObject({ error: expect.any(String) });
  });
});

describe("resolveReport", () => {
  it("uphold and dismiss both close a pending report and re-verify its job", async () => {
    const { resolveReport } = await import("@/app/actions/admin");
    const [job] = await db().select().from(canonicalJob).limit(1);
    const [report] = await db().insert(jobReport).values({ canonicalJobId: job!.id, reason: "SCAM_SIGNS" }).returning();

    const r = await resolveReport(report!.id, "UPHELD");
    expect(r).toEqual({ ok: true });
    const [after] = await db().select().from(jobReport).where(eq(jobReport.id, report!.id));
    expect(after!.status).toBe("UPHELD");

    const again = await resolveReport(report!.id, "DISMISSED");
    expect(again).toMatchObject({ error: expect.any(String) }); // already resolved
  });
});

describe("resolveIngestionError", () => {
  it("marks an error resolved and audits it", async () => {
    const { resolveIngestionError } = await import("@/app/actions/admin");
    const [source_] = await db().select().from((await import("@/db/schema")).source).limit(1);
    const [err] = await db()
      .insert(ingestionError)
      .values({ runId: (await db().select().from((await import("@/db/schema")).ingestionRun).limit(1))[0]!.id, sourceId: source_!.id, stage: "FETCH", message: "test", deadLetteredAt: new Date() })
      .returning();

    const r = await resolveIngestionError(err!.id);
    expect(r).toEqual({ ok: true });
    const [after] = await db().select().from(ingestionError).where(eq(ingestionError.id, err!.id));
    expect(after!.resolvedAt).not.toBeNull();
  });
});
