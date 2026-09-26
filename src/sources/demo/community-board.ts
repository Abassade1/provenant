import type { FetchPage, JobSource, LiveStatus, ParsedPosting, RawPosting, SourceDescriptor } from "../types";
import { DEMO_EMPLOYERS, type DemoJob } from "./data";

const DAY = 24 * 60 * 60 * 1000;

/**
 * A fictional third-party aggregator ("Maple Community Job Board (demo)").
 * It exists so the demo shows what the evidence engine does with postings
 * found somewhere other than the employer's own board:
 *   - reposts of real (demo) employer jobs → merged, "Found on 2 sources"
 *   - a repost with a different salary → SALARY_CONFLICT → Needs review
 *   - reposts of jobs the employer already took down → Not on employer's board
 *   - postings that imitate demo employers with scam patterns → High risk
 * Everything here is invented; phone numbers use the 555-01xx fictional range.
 */
export interface CommunityPosting {
  ref: string;
  employerName: string;
  title: string;
  location: string;
  workplace: string;
  employmentType: string;
  description: string;
  applyUrl: string;
  postedDaysAgo: number;
}

const BOARD = "https://community-jobs.example/postings/";
const FOOTER = "Posted via Maple Community Job Board (demo).";

function repost(j: DemoJob, n: number, overrides: Partial<CommunityPosting> = {}): CommunityPosting {
  const emp = DEMO_EMPLOYERS.find((e) => e.slug === j.employerSlug)!;
  return {
    ref: `community-${String(n).padStart(3, "0")}`,
    employerName: emp.name,
    title: n % 2 ? `${j.title} - ${j.city}` : j.title,
    location: `${j.city}, ${j.province}`,
    workplace: j.workplace,
    employmentType: j.employmentType,
    description: `${j.description}\n\n${FOOTER}`,
    applyUrl: `https://jobs.${emp.domain}/${j.externalRef}/apply`,
    postedDaysAgo: j.postedDaysAgo,
    ...overrides,
  };
}

export function buildCommunityPostings(all: DemoJob[]): CommunityPosting[] {
  const live = all.filter((j) => j.postedDaysAgo <= 25);
  const removed = all.filter((j) => j.postedDaysAgo > 25);
  const out: CommunityPosting[] = [];
  let n = 1;

  // Straight reposts (every 5th live job).
  for (const j of live.filter((_, i) => i % 5 === 0)) out.push(repost(j, n++));

  // A repost whose salary disagrees with the employer's.
  const withSalary = live.find((j) => j.salaryText && /year/.test(j.salaryText) && !out.some((o) => o.applyUrl.includes(j.externalRef)));
  if (withSalary) {
    out.push(
      repost(withSalary, n++, {
        description: withSalary.description.replace(/Compensation: [^\n]+/, "Compensation: $30,000–$34,000 per year.") + `\n\n${FOOTER}`,
      }),
    );
  }

  // Reposts of jobs the employer has already removed.
  for (const j of removed.slice(0, 2)) out.push(repost(j, n++));

  // Postings that imitate demo employers and show scam patterns.
  out.push({
    ref: `community-${String(n++).padStart(3, "0")}`,
    employerName: "Northwind Labs",
    title: "Remote Data Entry Clerk",
    location: "Remote - Canada",
    workplace: "Remote",
    employmentType: "Part-time",
    description:
      "Northwind Labs is hiring remote data entry clerks. No experience needed, $35 per hour.\n\n" +
      "Message our hiring manager on WhatsApp at +1 555 0100 to schedule your interview.\n\n" +
      "Successful applicants must purchase a starter kit ($250) before training begins.",
    applyUrl: "https://northwindlabs-careers.example/apply",
    postedDaysAgo: 2,
  });
  out.push({
    ref: `community-${String(n++).padStart(3, "0")}`,
    employerName: "Borealis Freight",
    title: "Package Handler",
    location: "Mississauga, ON",
    workplace: "On-site",
    employmentType: "Full-time",
    description:
      "Borealis Freight needs package handlers immediately. $24 per hour.\n\n" +
      "Send your resume to borealis.hiring.team@gmail.example and we will reply the same day.",
    applyUrl: "https://quickforms.example/borealis-apply",
    postedDaysAgo: 1,
  });
  out.push({
    ref: `community-${String(n++).padStart(3, "0")}`,
    employerName: "Tamarack Health Collective",
    title: "Medical Receptionist",
    location: "Halifax, NS",
    workplace: "On-site",
    employmentType: "Full-time",
    description:
      "Front desk role at a busy clinic. $21 per hour.\n\nText us at 555-0199 for a quick interview this week.",
    applyUrl: "https://jobs.tamarackhealth.example/reception/apply",
    postedDaysAgo: 3,
  });

  // An employer we know nothing else about.
  out.push({
    ref: `community-${String(n++).padStart(3, "0")}`,
    employerName: "Aurora Bakery",
    title: "Baker's Assistant",
    location: "Saskatoon, SK",
    workplace: "On-site",
    employmentType: "Part-time",
    description: "Early-morning shifts helping our bakers. $17.50 per hour. Apply in store or on this board.",
    applyUrl: `${BOARD}aurora-bakers-assistant`,
    postedDaysAgo: 5,
  });
  return out;
}

export class DemoCommunityBoard implements JobSource {
  readonly descriptor: SourceDescriptor = {
    key: "demo:community-board",
    type: "DEMO",
    provider: "demo-community",
    name: "Maple Community Job Board (demo)",
    termsReference: "Fictional data generated by Provenant (src/sources/demo). No third-party content.",
    allowedUse: "Any use. Must always be labelled as demo data.",
    rateLimitPerMin: 10_000,
    isDemo: true,
    employerOwned: false,
  };
  private readonly postings: CommunityPosting[];

  constructor(all: DemoJob[], private readonly now: () => Date = () => new Date()) {
    this.postings = buildCommunityPostings(all);
  }

  async fetch(): Promise<FetchPage> {
    return { postings: this.postings.map((p) => ({ externalRef: p.ref, payload: p })), nextCursor: null };
  }

  parse(raw: RawPosting): ParsedPosting {
    const p = raw.payload as CommunityPosting;
    return {
      externalRef: p.ref,
      title: p.title,
      employerName: p.employerName,
      locationText: p.location,
      employmentTypeText: p.employmentType,
      workplaceTypeText: p.workplace,
      descriptionText: p.description,
      url: BOARD + p.ref,
      applyUrl: p.applyUrl,
      postedAt: new Date(this.now().getTime() - p.postedDaysAgo * DAY),
      salary: null,
    };
  }

  async checkLive(): Promise<LiveStatus> {
    // An aggregator listing tells us nothing about whether the employer still lists it.
    return { state: "UNKNOWN", checkedAt: this.now(), detail: "Aggregator listings aren't used to confirm freshness." };
  }
}
