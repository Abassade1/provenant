import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { runCheck } from "@/checker/run-check";
import { ingestAll } from "@/pipeline/ingest-all";
import { createDemoSources } from "@/sources/demo";
import { resetDb } from "./db";

const db = () => getDb();
const opts = { backoffMs: () => 0 };

beforeEach(async () => {
  await resetDb();
  await ingestAll(db(), createDemoSources(), opts);
});
afterAll(async () => closeDb());

describe("runCheck", () => {
  it("matches a real indexed job from a short paste and links its real apply URL", async () => {
    const r = await runCheck(db(), {
      url: null,
      employerHint: "Northwind Labs",
      text: [
        "Job Title: Electrical Technologist",
        "Company: Northwind Labs",
        "Location: Edmonton, AB",
        "Compensation: $72,000–$90,000 per year.",
      ].join("\n"),
    });
    expect(r.ok).toBe(true);
    expect(r.matchedCanonicalJobId).not.toBeNull();
    expect(r.matchedApplyUrl).toMatch(/^https:\/\/jobs\.northwindlabs\.example\//);
    expect(r.verification!.status).toBe("VERIFIED");
    expect(r.verification!.signals.map((s) => s.code)).toEqual(
      expect.arrayContaining(["ON_EMPLOYER_ATS", "EMPLOYER_IDENTITY_CONFIRMED", "RECENTLY_CONFIRMED_LIVE"]),
    );
  });

  it("flags a scam message as HIGH_RISK without borrowing the real employer's trust", async () => {
    const r = await runCheck(db(), {
      url: null,
      employerHint: "Northwind Labs",
      text: [
        "Northwind Labs is hiring Remote Data Entry Clerks, $35/hr, no experience needed.",
        "Message our hiring manager on WhatsApp at +1 555 0100 to schedule your interview.",
        "You must purchase a starter kit ($250) before training begins.",
        "Apply at https://northwindlabs-careers.example/apply",
      ].join("\n"),
    });
    expect(r.ok).toBe(true);
    expect(r.verification!.status).toBe("HIGH_RISK");
    expect(r.matchedCanonicalJobId).toBeNull();
    expect(r.verification!.signals.map((s) => s.code)).not.toContain("EMPLOYER_IDENTITY_CONFIRMED");
  });

  it("is honest about an employer we've never seen", async () => {
    const r = await runCheck(db(), { url: null, employerHint: "Totally Unknown Co", text: "Job Title: Barista\nWe're hiring!" });
    expect(r.ok).toBe(true);
    expect(r.verification!.status).toBe("UNVERIFIED");
    expect(r.verification!.signals).toHaveLength(0);
    expect(r.matchedCanonicalJobId).toBeNull();
  });

  it("never fetches a disallowed host and says why", async () => {
    const r = await runCheck(db(), { url: "https://www.linkedin.com/jobs/view/123", text: null, employerHint: null });
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toMatch(/linkedin/i);
  });

  it("asks for input when given neither a URL nor text", async () => {
    const r = await runCheck(db(), { url: null, text: "   ", employerHint: null });
    expect(r.ok).toBe(false);
  });

  it("stores the full text for encryption (caller encrypts it) and never omits it on a successful check", async () => {
    const r = await runCheck(db(), { url: null, employerHint: "Aurora Bakery", text: "Job Title: Baker's Assistant\nCompany: Aurora Bakery" });
    expect(r.rawTextForStorage).toContain("Baker's Assistant");
  });
});
