import { beforeEach, describe, expect, it } from "vitest";
import { clearRobotsCache } from "@/lib/http";
import { fakeGreenhouse, makeSource } from "./greenhouse-fake";

describe("GreenhouseSource", () => {
  beforeEach(() => clearRobotsCache());

  it("records its terms and allowed use", () => {
    const d = makeSource(fakeGreenhouse().fetchImpl).descriptor;
    expect(d.type).toBe("ATS_PUBLIC_BOARD");
    expect(d.termsReference).toMatch(/developers\.greenhouse\.io/);
    expect(d.allowedUse.length).toBeGreaterThan(10);
  });

  it("fetches the board and parses postings", async () => {
    const src = makeSource(fakeGreenhouse().fetchImpl);
    const page = await src.fetch(null);
    expect(page.postings).toHaveLength(4);
    expect(page.nextCursor).toBeNull();

    const p = src.parse(page.postings[0]!);
    expect(p).toMatchObject({
      externalRef: "4000001",
      title: "Sr. Software Engineer, Platform (Hybrid)",
      employerName: "Maplewood Analytics",
      locationText: "Toronto, Ontario, Canada",
      employmentTypeText: "Full-time",
      workplaceTypeText: "Hybrid",
      applyUrl: "https://job-boards.greenhouse.io/maplewoodfixture/jobs/4000001",
    });
    expect(p.postedAt?.toISOString()).toBe("2026-09-12T13:00:00.000Z");
    expect(p.descriptionText).toContain("• TypeScript & Go");
    expect(p.descriptionText).toContain("This posting is for an existing vacancy.");
    expect(p.descriptionText).not.toMatch(/<|&lt;/);
  });

  it("reports LIVE / GONE from the single-job endpoint", async () => {
    const src = makeSource(fakeGreenhouse().fetchImpl);
    expect((await src.checkLive("4000001")).state).toBe("LIVE");
    expect((await src.checkLive("999")).state).toBe("GONE");
  });

  it("reports UNKNOWN (not GONE) when the check itself fails", async () => {
    const src = makeSource(async (url: string) =>
      url.endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response("", { status: 500 }),
    );
    expect((await src.checkLive("4000001")).state).toBe("UNKNOWN");
  });
});
