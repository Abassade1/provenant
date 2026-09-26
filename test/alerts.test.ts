import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { canonicalJob, notification, savedSearch, user } from "@/db/schema";
import { generateSavedSearchAlerts } from "@/evidence/alerts";
import { ingestAll } from "@/pipeline/ingest-all";
import { createDemoSources } from "@/sources/demo";
import { resetDb } from "./db";

const db = () => getDb();
const opts = { backoffMs: () => 0 };
const HOUR = 3_600_000;

beforeEach(async () => {
  await resetDb();
  await ingestAll(db(), createDemoSources(), opts);
});
afterAll(async () => closeDb());

async function makeUser() {
  const [u] = await db().insert(user).values({ email: `alert-${Date.now()}-${Math.random()}@example.com` }).returning();
  return u!.id;
}

describe("generateSavedSearchAlerts", () => {
  it("notifies about jobs seen since the search was saved, and none the second time (nothing new)", async () => {
    const userId = await makeUser();
    const [search] = await db().insert(savedSearch).values({ userId, name: "Everything", filters: {} }).returning();
    // Backdate so the demo jobs (seeded in beforeEach, before this insert) count as "new" —
    // a freshly saved search shouldn't retroactively alert on jobs that already existed.
    await db().update(savedSearch).set({ createdAt: new Date(0) }).where(eq(savedSearch.id, search!.id));

    const first = await generateSavedSearchAlerts(db());
    expect(first.searches).toBe(1);
    expect(first.notifications).toBeGreaterThan(0); // every demo job is "new" relative to the search's createdAt

    const notes = await db().select().from(notification).where(eq(notification.userId, userId));
    expect(notes.length).toBe(first.notifications);
    expect(notes[0]).toMatchObject({ kind: "saved_search_match", title: expect.stringContaining("Everything") });
    expect(notes[0]!.link).toMatch(/^\/jobs\//);

    const [updated] = await db().select().from(savedSearch).where(eq(savedSearch.id, search!.id));
    expect(updated!.lastNotifiedAt).not.toBeNull();

    const second = await generateSavedSearchAlerts(db());
    expect(second.notifications).toBe(0); // nothing new since lastNotifiedAt
  });

  it("only alerts for jobs matching the search's own filters", async () => {
    const userId = await makeUser();
    await db().insert(savedSearch).values({ userId, name: "Remote only", filters: { remoteType: "REMOTE", sort: "relevance", page: 1 } });

    const result = await generateSavedSearchAlerts(db());
    const notes = await db().select().from(notification).where(eq(notification.userId, userId));
    expect(notes.length).toBe(result.notifications);

    const remoteJobIds = new Set((await db().select({ id: canonicalJob.id }).from(canonicalJob).where(eq(canonicalJob.remoteType, "REMOTE"))).map((j) => j.id));
    for (const n of notes) {
      const jobId = n.link!.replace("/jobs/", "");
      expect(remoteJobIds.has(jobId)).toBe(true);
    }
  });

  it("notifies again once a genuinely new job appears after the last check", async () => {
    const userId = await makeUser();
    await db().insert(savedSearch).values({ userId, name: "All", filters: {} });
    await generateSavedSearchAlerts(db());

    const [job] = await db().select().from(canonicalJob).limit(1);
    await db().update(canonicalJob).set({ firstSeenAt: new Date(Date.now() + HOUR) }).where(eq(canonicalJob.id, job!.id));

    const second = await generateSavedSearchAlerts(db(), new Date(Date.now() + 2 * HOUR));
    expect(second.notifications).toBe(1);
  });

  it("skips a saved search whose stored filters no longer parse, without failing the batch", async () => {
    const userId = await makeUser();
    const [broken] = await db().insert(savedSearch).values({ userId, name: "Broken", filters: { salaryMin: "not-a-number" } }).returning();
    await db().update(savedSearch).set({ createdAt: new Date(0) }).where(eq(savedSearch.id, broken!.id));
    const otherUser = await makeUser();
    const [fine] = await db().insert(savedSearch).values({ userId: otherUser, name: "Fine", filters: {} }).returning();
    await db().update(savedSearch).set({ createdAt: new Date(0) }).where(eq(savedSearch.id, fine!.id));

    const result = await generateSavedSearchAlerts(db());
    expect(result.searches).toBe(2);
    expect(await db().select().from(notification).where(eq(notification.userId, userId))).toHaveLength(0);
    expect((await db().select().from(notification).where(eq(notification.userId, otherUser))).length).toBeGreaterThan(0);
  });
});
