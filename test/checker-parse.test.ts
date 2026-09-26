import { describe, expect, it } from "vitest";
import { extractFromText } from "@/checker/parse";
import { isDisallowedHost } from "@/checker/denylist";

describe("extractFromText", () => {
  it("reads labelled fields", () => {
    const r = extractFromText("Job Title: Baker\nCompany: Aurora Bakery\nLocation: Saskatoon, SK\nEarly shifts, $17.50/hr.");
    expect(r).toMatchObject({ title: "Baker", employerName: "Aurora Bakery", location: "Saskatoon, SK" });
    expect(r.salary?.min).toBe(17.5);
  });

  it("prefers an explicit employer hint over a label in the text", () => {
    const r = extractFromText("Company: Wrong Co\nWe are hiring.", "Right Co");
    expect(r.employerName).toBe("Right Co");
  });

  it("falls back to the first non-empty line for an untitled paste", () => {
    const r = extractFromText("\n\nSenior Developer role at a growing startup\nMore details below.");
    expect(r.title).toBe("Senior Developer role at a growing startup");
  });

  it("picks the URL nearest the word 'apply'", () => {
    const r = extractFromText("See our site: https://example.com/about\nApply here: https://example.com/jobs/1/apply");
    expect(r.applyUrl).toBe("https://example.com/jobs/1/apply");
  });

  it("flags off-platform contact and upfront payment requests", () => {
    const r = extractFromText("Message us on WhatsApp. Buy a starter kit before training.");
    expect(r.offPlatformContact).toBe(true);
    expect(r.upfrontPayment).toBe(true);
  });

  it("doesn't flag ordinary text", () => {
    const r = extractFromText("We offer great benefits and a competitive salary.");
    expect(r.offPlatformContact).toBe(false);
    expect(r.upfrontPayment).toBe(false);
  });
});

describe("isDisallowedHost", () => {
  it.each(["www.linkedin.com", "ca.indeed.com", "glassdoor.ca", "m.facebook.com"])("%s is disallowed", (h) => {
    expect(isDisallowedHost(h)).toBe(true);
  });
  it.each(["jobs.acme.example", "boards.greenhouse.io", "www.jobbank.gc.ca"])("%s is allowed", (h) => {
    expect(isDisallowedHost(h)).toBe(false);
  });
});
