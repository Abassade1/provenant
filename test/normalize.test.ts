import { describe, expect, it } from "vitest";
import { normalizeEmploymentType, normalizeTitle, parseLocation } from "@/pipeline/stages/normalize";
import { validate } from "@/pipeline/stages/validate";
import { normalize } from "@/pipeline/stages/normalize";

describe("normalizeTitle", () => {
  it.each([
    ["Sr. Software Engineer, Platform (Hybrid)", "senior software engineer platform", "software engineer platform"],
    ["Software Developer - Toronto", "software developer", "software developer"],
    ["Registered Nurse – Medical/Surgical", "registered nurse", "registered nurse"],
    ["Jr Dev", "junior developer", "developer"],
    ["Data Analyst II", "data analyst ii", "data analyst"],
    ["Lead", "lead", "lead"],
  ])("%s", (input, normalized, stem) => {
    expect(normalizeTitle(input)).toEqual({ normalized, stem });
  });
});

describe("parseLocation", () => {
  it.each([
    ["Toronto, ON", { city: "Toronto", province: "ON", country: "CA", remoteHint: "UNKNOWN" }],
    ["Toronto, Ontario, Canada", { city: "Toronto", province: "ON", country: "CA", remoteHint: "UNKNOWN" }],
    ["Montréal", { city: "Montréal", province: "QC", country: "CA", remoteHint: "UNKNOWN" }],
    ["Remote - Canada", { city: null, province: null, country: "CA", remoteHint: "REMOTE" }],
    ["Hybrid (Vancouver, BC)", { city: "Vancouver", province: "BC", country: "CA", remoteHint: "HYBRID" }],
    ["Austin, TX", { city: "Austin", province: null, country: "OTHER", remoteHint: "UNKNOWN" }],
    ["London", { city: "London", province: null, country: "UNKNOWN", remoteHint: "UNKNOWN" }],
    ["London, ON", { city: "London", province: "ON", country: "CA", remoteHint: "UNKNOWN" }],
    ["Remote", { city: null, province: null, country: "UNKNOWN", remoteHint: "REMOTE" }],
  ])("%s", (input, expected) => {
    expect(parseLocation(input)).toEqual(expected);
  });

  it("handles empty input", () => {
    expect(parseLocation(null).country).toBe("UNKNOWN");
  });
});

describe("normalizeEmploymentType", () => {
  it.each([
    ["Full-time", "Developer", "FULL_TIME"],
    ["Part time", "Cook", "PART_TIME"],
    [null, "Software Developer (Contract)", "CONTRACT"],
    [null, "Summer Student - Co-op", "INTERNSHIP"],
    ["Permanent", "Nurse", "FULL_TIME"],
    [null, "Analyst", "UNKNOWN"],
  ])("%s / %s", (text, title, expected) => {
    expect(normalizeEmploymentType(text, title)).toBe(expected);
  });
});

describe("validate", () => {
  const base = {
    externalRef: "1",
    title: "Analyst",
    employerName: "Acme",
    locationText: "Toronto, ON",
    employmentTypeText: null,
    workplaceTypeText: null,
    descriptionText: "",
    url: "https://example.com/jobs/1",
    applyUrl: null,
    postedAt: null,
    salary: null,
  };

  it("accepts a Canadian posting", () => {
    expect(validate(normalize(base)).ok).toBe(true);
  });
  it("skips (not errors) postings outside Canada", () => {
    expect(validate(normalize({ ...base, locationText: "Austin, TX" }))).toMatchObject({ ok: false, skip: true });
  });
  it("rejects malformed postings", () => {
    expect(validate(normalize({ ...base, url: "javascript:alert(1)" }))).toMatchObject({ ok: false, skip: false });
    expect(validate(normalize({ ...base, title: "" }))).toMatchObject({ ok: false, skip: false });
  });
});
