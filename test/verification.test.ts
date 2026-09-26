import { describe, expect, it } from "vitest";
import {
  findOffPlatformContact,
  findUpfrontPayment,
  lookalikeOf,
  registrableDomain,
  salariesConflict,
  STATUS_RULES,
  verify,
  type SalaryInput,
  type SignalCode,
  type VerificationInput,
} from "@/verification";

const NOW = new Date("2026-09-26T12:00:00Z");
const H = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);

/** A job that satisfies R5 (VERIFIED). Tests knock out one piece at a time. */
function base(over: Partial<VerificationInput> = {}): VerificationInput {
  return {
    now: NOW,
    job: {
      applyUrl: "https://job-boards.greenhouse.io/acme/jobs/1",
      text: "Build things. The salary range is $90,000–$110,000 per year.",
      vacancyStatement: null,
      firstSeenAt: ago(48),
      lastVerifiedAt: ago(2),
      expiredAt: null,
    },
    employer: {
      name: "Acme Robotics",
      identityStatus: "CONFIRMED",
      identityEvidence: [{ text: "acmerobotics.example/careers links to this board.", url: "https://acmerobotics.example/careers", observedAt: ago(5).toISOString() }],
      domains: ["acmerobotics.example"],
      hasEmployerBoard: true,
      employerBoardCheckedAt: ago(2),
    },
    sources: [
      {
        sourceId: "s-board",
        sourceName: "Acme Robotics — Greenhouse job board",
        employerOwned: true,
        url: "https://job-boards.greenhouse.io/acme/jobs/1",
        applyUrl: "https://job-boards.greenhouse.io/acme/jobs/1",
        titleStem: "engineer",
        locationKey: "toronto|ON|",
        lastVerifiedAt: ago(2),
        expiredAt: null,
      },
    ],
    salaries: [],
    pendingReporters: 0,
    openDuplicateCluster: false,
    override: null,
    knownEmployerDomains: ["acmerobotics.example", "northwindlabs.example"],
    ...over,
  };
}

const codes = (i: VerificationInput) => verify(i).signals.map((s) => s.code);
const withJob = (job: Partial<VerificationInput["job"]>) => base({ job: { ...base().job, ...job } });
const salary = (min: number, max: number, over: Partial<SalaryInput> = {}): SalaryInput => ({
  sourceId: "s-board",
  type: "EMPLOYER_STATED",
  min,
  max,
  period: "YEAR",
  currency: "CAD",
  employerHosted: true,
  evidenceText: `$${min}–$${max} per year`,
  ...over,
});

// ── Signals ───────────────────────────────────────────────────────────────

describe("signals", () => {
  it("baseline job has exactly the expected positive signals", () => {
    expect(codes(base()).sort()).toEqual(
      ["ON_EMPLOYER_ATS", "EMPLOYER_IDENTITY_CONFIRMED", "APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", "RECENTLY_CONFIRMED_LIVE"].sort(),
    );
  });

  it("every signal carries evidence text", () => {
    for (const s of verify(base()).signals) expect(s.evidenceText.length).toBeGreaterThan(5);
  });

  it("ON_EMPLOYER_ATS needs an active employer-owned record", () => {
    const i = base();
    i.sources[0]!.expiredAt = ago(1);
    i.sources.push({ ...i.sources[0]!, sourceId: "agg", employerOwned: false, expiredAt: null });
    expect(codes(i)).not.toContain("ON_EMPLOYER_ATS");
  });

  it("NOT_FOUND_ON_EMPLOYER_SITE when the employer's board was checked and lacks the posting", () => {
    const i = base({
      sources: [{ ...base().sources[0]!, sourceId: "agg", sourceName: "Aggregator", employerOwned: false }],
    });
    expect(codes(i)).toContain("NOT_FOUND_ON_EMPLOYER_SITE");
    expect(codes(i)).not.toContain("ON_EMPLOYER_ATS");
  });

  it("no NOT_FOUND when the employer has no board we check", () => {
    const i = base({
      employer: { ...base().employer!, hasEmployerBoard: false, employerBoardCheckedAt: null },
      sources: [{ ...base().sources[0]!, employerOwned: false }],
    });
    expect(codes(i)).not.toContain("NOT_FOUND_ON_EMPLOYER_SITE");
  });

  it("EMPLOYER_IDENTITY_CONFIRMED only for CONFIRMED and only when the posting is tied to the employer", () => {
    expect(codes(base({ employer: { ...base().employer!, identityStatus: "PROBABLE" } }))).not.toContain("EMPLOYER_IDENTITY_CONFIRMED");
    // Impersonator: aggregator posting, apply link elsewhere → identity isn't lent to it.
    const imposter = base({
      job: { ...base().job, applyUrl: "https://acmerobotics-hiring.example/apply" },
      sources: [{ ...base().sources[0]!, employerOwned: false }],
    });
    expect(codes(imposter)).not.toContain("EMPLOYER_IDENTITY_CONFIRMED");
  });

  it("apply link on employer domain, known ATS or government board is positive", () => {
    expect(codes(withJob({ applyUrl: "https://careers.acmerobotics.example/apply" }))).toContain("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS");
    expect(codes(withJob({ applyUrl: "https://acme.wd3.myworkdayjobs.com/x" }))).toContain("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS");
    expect(codes(withJob({ applyUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/1" }))).toContain("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS");
  });

  it("APPLY_URL_MISMATCH for an unrelated domain", () => {
    const c = codes(withJob({ applyUrl: "https://quickforms.example/apply" }));
    expect(c).toContain("APPLY_URL_MISMATCH");
    expect(c).not.toContain("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS");
  });

  it("LOOKALIKE_DOMAIN replaces (doesn't double-count with) APPLY_URL_MISMATCH", () => {
    const c = codes(withJob({ applyUrl: "https://acmerobotics-careers.example/apply" }));
    expect(c).toContain("LOOKALIKE_DOMAIN");
    expect(c).not.toContain("APPLY_URL_MISMATCH");
  });

  it("RECENTLY_CONFIRMED_LIVE within 72 h only", () => {
    expect(codes(withJob({ lastVerifiedAt: ago(71) }))).toContain("RECENTLY_CONFIRMED_LIVE");
    expect(codes(withJob({ lastVerifiedAt: ago(73) }))).not.toContain("RECENTLY_CONFIRMED_LIVE");
  });

  it("STALE after 14 days without confirmation (or never confirmed)", () => {
    expect(codes(withJob({ lastVerifiedAt: ago(14 * 24 + 1) }))).toContain("STALE");
    expect(codes(withJob({ lastVerifiedAt: ago(13 * 24) }))).not.toContain("STALE");
    expect(codes(withJob({ lastVerifiedAt: null, firstSeenAt: ago(15 * 24) }))).toContain("STALE");
    expect(codes(withJob({ lastVerifiedAt: null, firstSeenAt: ago(15 * 24), expiredAt: ago(1) }))).not.toContain("STALE");
  });

  it("SALARY_STATED_BY_EMPLOYER only from an employer-hosted posting", () => {
    expect(codes(base({ salaries: [salary(90000, 110000)] }))).toContain("SALARY_STATED_BY_EMPLOYER");
    expect(codes(base({ salaries: [salary(90000, 110000, { employerHosted: false })] }))).not.toContain("SALARY_STATED_BY_EMPLOYER");
  });

  it("SALARY_CONFLICT across sources beyond tolerance, not within it", () => {
    const conflict = base({ salaries: [salary(90000, 110000), salary(50000, 60000, { sourceId: "agg", employerHosted: false })] });
    expect(codes(conflict)).toContain("SALARY_CONFLICT");
    const close = base({ salaries: [salary(90000, 110000), salary(112000, 120000, { sourceId: "agg" })] });
    expect(codes(close)).not.toContain("SALARY_CONFLICT");
    const hourly = base({ salaries: [salary(90000, 110000), salary(43, 53, { sourceId: "agg", period: "HOUR" })] });
    expect(codes(hourly)).not.toContain("SALARY_CONFLICT"); // $43–53/h ≈ $89K–110K/yr
  });

  it("VACANCY_STATUS_DISCLOSED quotes the statement; 'not an existing vacancy' is neutral", () => {
    const yes = verify(withJob({ vacancyStatement: "This posting is for an existing vacancy." })).signals.find((s) => s.code === "VACANCY_STATUS_DISCLOSED")!;
    expect(yes.polarity).toBe("POSITIVE");
    expect(yes.evidenceText).toBe("“This posting is for an existing vacancy.”");
    const no = verify(withJob({ vacancyStatement: "This posting is not for an existing vacancy; we are building a pool of candidates." })).signals.find(
      (s) => s.code === "VACANCY_STATUS_DISCLOSED",
    )!;
    expect(no.polarity).toBe("NEUTRAL");
  });

  it("CONSISTENT_ACROSS_SOURCES when ≥ 2 sources agree", () => {
    const i = base();
    i.sources.push({ ...i.sources[0]!, sourceId: "agg", employerOwned: false });
    expect(codes(i)).toContain("CONSISTENT_ACROSS_SOURCES");
    i.sources[1]!.locationKey = "ottawa|ON|";
    expect(codes(i)).not.toContain("CONSISTENT_ACROSS_SOURCES");
  });

  it("USER_REPORTS needs 3 distinct reporters", () => {
    expect(codes(base({ pendingReporters: 2 }))).not.toContain("USER_REPORTS");
    expect(codes(base({ pendingReporters: 3 }))).toContain("USER_REPORTS");
  });

  it("OFF_PLATFORM_CONTACT and UPFRONT_PAYMENT_REQUEST quote the triggering sentence", () => {
    const s = verify(withJob({ text: "Great role. Message us on WhatsApp to continue. You must buy a starter kit for training." })).signals;
    expect(s.find((x) => x.code === "OFF_PLATFORM_CONTACT")!.evidenceText).toBe("“Message us on WhatsApp to continue.”");
    expect(s.find((x) => x.code === "UPFRONT_PAYMENT_REQUEST")!.evidenceText).toBe("“You must buy a starter kit for training.”");
  });

  it("signals are ordered strongest first and deterministic", () => {
    const i = withJob({ text: "Message us on WhatsApp.", applyUrl: "https://quickforms.example/a" });
    const a = verify(i);
    const b = verify(i);
    expect(a).toEqual(b);
    const w = a.signals.map((s) => s.weight);
    expect(w).toEqual([...w].sort((x, y) => y - x));
  });
});

// ── Patterns ──────────────────────────────────────────────────────────────

describe("scam text patterns", () => {
  it.each([
    "Please contact our recruiter on Telegram @hr_team.",
    "Send your resume to jobs.team@gmail.com today.",
    "Text me at 555-0100 for details.",
  ])("off-platform: %s", (t) => expect(findOffPlatformContact(t)).toHaveLength(1));

  it.each([
    "We never ask candidates to contact us on WhatsApp.",
    "Apply through our careers site. Questions? careers@acmerobotics.example",
  ])("not off-platform: %s", (t) => expect(findOffPlatformContact(t)).toHaveLength(0));

  it.each([
    "A $150 registration fee is required before onboarding.",
    "You will receive a cheque; deposit it and send back the difference.",
    "Payment for the equipment is made in Bitcoin.",
    "Buy the laptop from our approved vendor before your start date.",
  ])("payment: %s", (t) => expect(findUpfrontPayment(t)).toHaveLength(1));

  it.each([
    "We provide a laptop and all equipment.",
    "Training is paid and we reimburse certification costs.",
    "Competitive pay and benefits.",
  ])("not payment: %s", (t) => expect(findUpfrontPayment(t)).toHaveLength(0));
});

describe("domains", () => {
  it("registrable domain", () => {
    expect(registrableDomain("jobs.northwindlabs.example")).toBe("northwindlabs.example");
    expect(registrableDomain("careers.acme.co.uk")).toBe("acme.co.uk");
    expect(registrableDomain("www.jobbank.gc.ca")).toBe("jobbank.gc.ca");
  });
  it.each([
    ["northwindlabs-careers.example", "northwindlabs.example"],
    ["northwind-labs.example", "northwindlabs.example"], // hyphenated copy of the brand
    ["nortwindlabs.example", "northwindlabs.example"],
    ["jobs.northwindlabs.example", null],
    ["boards.greenhouse.io", null],
    ["example.org", null],
  ])("%s → %s", (host, expected) => {
    expect(lookalikeOf(host, ["northwindlabs.example", "acmerobotics.example"])).toBe(expected);
  });
});

describe("salary conflict helper", () => {
  it("ignores different currencies", () => {
    expect(salariesConflict(salary(90000, 100000), salary(10000, 20000, { currency: "USD" }))).toBe(false);
  });
});

// ── Status rule table ─────────────────────────────────────────────────────

describe("status rules (first match wins)", () => {
  const scam = "Message us on WhatsApp. Pay the $100 training fee first.";
  const status = (i: VerificationInput) => {
    const r = verify(i);
    return `${r.ruleId}:${r.status}`;
  };

  it("R0 admin override beats everything", () => {
    expect(status(base({ override: { status: "UNVERIFIED", at: NOW, note: "x" }, job: { ...base().job, text: scam } }))).toBe("R0:UNVERIFIED");
  });
  it("R1 expired when the job or every source has expired", () => {
    expect(status(withJob({ expiredAt: ago(1) }))).toBe("R1:EXPIRED");
    const i = base();
    i.sources[0]!.expiredAt = ago(1);
    expect(status(i)).toBe("R1:EXPIRED");
  });
  it("R2 high risk with ≥ 2 scam patterns", () => {
    expect(status(withJob({ text: scam }))).toBe("R2:HIGH_RISK");
    expect(status(withJob({ text: "DM us on Telegram.", applyUrl: "https://acmerobotics-jobs.example/x" }))).toBe("R2:HIGH_RISK");
  });
  it("R3 review for one pattern, reports, salary conflict or open duplicate", () => {
    expect(status(withJob({ text: "Text us at 555-0100." }))).toBe("R3:REVIEW_REQUIRED");
    expect(status(base({ pendingReporters: 3 }))).toBe("R3:REVIEW_REQUIRED");
    expect(status(base({ openDuplicateCluster: true }))).toBe("R3:REVIEW_REQUIRED");
    expect(status(base({ salaries: [salary(90000, 110000), salary(40000, 45000, { sourceId: "agg" })] }))).toBe("R3:REVIEW_REQUIRED");
  });
  it("R3 reports alone can never produce HIGH_RISK", () => {
    expect(status(base({ pendingReporters: 500 }))).toBe("R3:REVIEW_REQUIRED");
  });
  it("R4 stale", () => {
    expect(status(withJob({ lastVerifiedAt: ago(15 * 24) }))).toBe("R4:STALE");
  });
  it("R5 verified", () => {
    expect(status(base())).toBe("R5:VERIFIED");
  });
  it("R6 partially verified when one of the core facts is missing", () => {
    expect(status(withJob({ lastVerifiedAt: ago(80) }))).toBe("R6:PARTIALLY_VERIFIED");
    expect(status(base({ employer: { ...base().employer!, identityStatus: "PROBABLE" } }))).toBe("R6:PARTIALLY_VERIFIED");
  });
  it("R7 unverified otherwise, including not found on the employer's board", () => {
    const i = base({ sources: [{ ...base().sources[0]!, employerOwned: false }] });
    i.employer!.identityStatus = "PROBABLE";
    expect(status(i)).toBe("R7:UNVERIFIED");
    expect(status(base({ employer: null, sources: [], job: { ...base().job, applyUrl: null } }))).toBe("R7:UNVERIFIED");
  });

  it("the published rule table lists every status and matches the implementation order", () => {
    expect(STATUS_RULES.map((r) => r.id)).toEqual(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
    const statuses = new Set(STATUS_RULES.map((r) => r.status));
    for (const s of ["EXPIRED", "HIGH_RISK", "REVIEW_REQUIRED", "STALE", "VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED"]) {
      expect(statuses.has(s as never)).toBe(true);
    }
  });

  it("plain-language copy never calls a posting a scam outright", () => {
    for (const r of STATUS_RULES) expect(r.when).not.toMatch(/\bis a scam\b|\bscammer\b|\bfraud(ulent)?\b/i);
  });
});

// Keep the signal list honest: every code in the brief exists.
it("implements every MVP signal from the brief", () => {
  const all: SignalCode[] = [
    "ON_EMPLOYER_ATS", "EMPLOYER_IDENTITY_CONFIRMED", "APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", "RECENTLY_CONFIRMED_LIVE",
    "SALARY_STATED_BY_EMPLOYER", "VACANCY_STATUS_DISCLOSED", "CONSISTENT_ACROSS_SOURCES", "NOT_FOUND_ON_EMPLOYER_SITE",
    "APPLY_URL_MISMATCH", "LOOKALIKE_DOMAIN", "OFF_PLATFORM_CONTACT", "UPFRONT_PAYMENT_REQUEST", "SALARY_CONFLICT", "STALE", "USER_REPORTS",
  ];
  expect(all).toHaveLength(15);
});
