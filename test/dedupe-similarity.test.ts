import { describe, expect, it } from "vitest";
import { lexicalScorer, MERGE_THRESHOLD, REVIEW_THRESHOLD, type DedupeFeatures } from "@/evidence/dedupe/similarity";

const DESC =
  "We build forecasting tools for Canadian grocers. You will design data pipelines in TypeScript and Go, " +
  "own services end to end, and work closely with customers. PostgreSQL experience is an asset.";

const job = (over: Partial<DedupeFeatures> = {}): DedupeFeatures => ({
  titleNormalized: "senior software engineer platform",
  description: DESC,
  city: "Toronto",
  province: "ON",
  remoteType: "HYBRID",
  salary: { min: 120000, max: 145000, period: "YEAR", currency: "CAD" },
  skills: ["TypeScript", "Go"],
  urls: ["https://job-boards.greenhouse.io/maplewood/jobs/1"],
  ...over,
});

describe("dedupe similarity fixtures", () => {
  it("true duplicate: same posting reformatted on another source → merge", () => {
    const repost = job({
      titleNormalized: "senior software engineer platform",
      description: DESC.toUpperCase() + "\n\nPosted via Maple Community Job Board (demo).",
      skills: [],
      urls: ["https://community-jobs.example/postings/77"],
    });
    expect(lexicalScorer.score(job(), repost).score).toBeGreaterThanOrEqual(MERGE_THRESHOLD);
  });

  it("true duplicate: same apply URL is decisive", () => {
    const r = lexicalScorer.score(job(), job({ description: "Short blurb.", urls: ["https://job-boards.greenhouse.io/maplewood/jobs/1/"] }));
    expect(r.features.url).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(MERGE_THRESHOLD);
  });

  it("hourly vs annual salary of the same range still counts as overlap", () => {
    const r = lexicalScorer.score(job(), job({ salary: { min: 57.69, max: 69.71, period: "HOUR", currency: "CAD" } }));
    expect(r.features.salary).toBeGreaterThan(0.95);
  });

  it("near miss: same title, different city → never merged, never even reviewed", () => {
    const r = lexicalScorer.score(job(), job({ city: "Ottawa", urls: ["https://job-boards.greenhouse.io/maplewood/jobs/2"] }));
    expect(r.score).toBeLessThan(REVIEW_THRESHOLD);
  });

  it("near miss: same title and city, different role content → below review", () => {
    const r = lexicalScorer.score(
      job(),
      job({
        description: "Lead our mobile team shipping iOS and Android apps in Swift and Kotlin for retail customers across Canada.",
        salary: { min: 150000, max: 180000, period: "YEAR", currency: "CAD" },
        skills: ["Swift", "Kotlin"],
        urls: ["https://job-boards.greenhouse.io/maplewood/jobs/3"],
      }),
    );
    expect(r.score).toBeLessThan(REVIEW_THRESHOLD);
  });

  it("ambiguous: similar text but different salary → review band", () => {
    const r = lexicalScorer.score(
      job(),
      job({
        description: DESC.replace("PostgreSQL experience is an asset.", "Experience with Kafka and dbt is required."),
        salary: { min: 90000, max: 100000, period: "YEAR", currency: "CAD" },
        urls: ["https://community-jobs.example/postings/9"],
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(r.score).toBeLessThan(MERGE_THRESHOLD);
  });

  it("is symmetric", () => {
    const a = job();
    const b = job({ description: DESC.slice(0, 80), city: "Toronto", urls: [] });
    expect(lexicalScorer.score(a, b).score).toBe(lexicalScorer.score(b, a).score);
  });
});
