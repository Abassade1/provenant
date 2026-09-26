import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { jobCheck, jobReport } from "@/db/schema";
import { purgeExpiredChecks } from "@/checker/purge";
import { resetDb } from "./db";

const db = () => getDb();
const HOUR = 3_600_000;

beforeEach(async () => resetDb());
afterAll(async () => closeDb());

describe("purgeExpiredChecks", () => {
  it("deletes only checks past their retention period", async () => {
    const now = new Date();
    const [expired] = await db().insert(jobCheck).values({ status: "COMPLETE", expiresAt: new Date(now.getTime() - HOUR) }).returning();
    const [current] = await db().insert(jobCheck).values({ status: "COMPLETE", expiresAt: new Date(now.getTime() + HOUR) }).returning();

    const deleted = await purgeExpiredChecks(db(), now);
    expect(deleted).toBe(1);

    const remaining = await db().select().from(jobCheck);
    expect(remaining.map((r) => r.id)).toEqual([current!.id]);
    expect(remaining.find((r) => r.id === expired!.id)).toBeUndefined();
  });

  it("cascades to reports that only reference the purged check", async () => {
    const now = new Date();
    const [expired] = await db().insert(jobCheck).values({ status: "COMPLETE", expiresAt: new Date(now.getTime() - HOUR) }).returning();
    await db().insert(jobReport).values({ jobCheckId: expired!.id, reason: "SCAM_SIGNS" });

    await purgeExpiredChecks(db(), now);

    const reports = await db().select().from(jobReport).where(eq(jobReport.jobCheckId, expired!.id));
    expect(reports).toHaveLength(0);
  });

  it("is a no-op when nothing has expired", async () => {
    await db().insert(jobCheck).values({ status: "COMPLETE", expiresAt: new Date(Date.now() + HOUR) });
    expect(await purgeExpiredChecks(db())).toBe(0);
  });
});
