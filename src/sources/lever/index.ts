import { z } from "zod";
import { HttpError, politeFetch, politeFetchJson, type FetchLike } from "@/lib/http";
import { probeCareersPageLinksBoard } from "../identity-probe";
import type {
  EmployerHint,
  FetchPage,
  IdentityProbe,
  JobSource,
  LiveStatus,
  ParsedPosting,
  RawPosting,
  SalaryHint,
  SourceDescriptor,
} from "../types";

/**
 * Lever Postings API — public, unauthenticated endpoints for an employer's
 * published postings. Docs: https://github.com/lever/postings-api
 */
export const LEVER_API = "https://api.lever.co/v0/postings";
export const LEVER_TERMS =
  "https://github.com/lever/postings-api (Postings API: public endpoints for a company's published job postings, no key required). " +
  "Aggregation across employers is not explicitly addressed — see docs/sources.md.";

const PAGE_SIZE = 100;

const leverPosting = z.object({
  id: z.string(),
  text: z.string(),
  categories: z
    .object({
      commitment: z.string().nullish(),
      location: z.string().nullish(),
      team: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
    })
    .nullish(),
  createdAt: z.number().nullish(),
  hostedUrl: z.string().url(),
  applyUrl: z.string().url().nullish(),
  descriptionPlain: z.string().nullish(),
  additionalPlain: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  workplaceType: z.string().nullish(),
  country: z.string().nullish(),
  salaryRange: z
    .object({
      min: z.number().nullish(),
      max: z.number().nullish(),
      currency: z.string().nullish(),
      interval: z.string().nullish(),
    })
    .nullish(),
  salaryDescriptionPlain: z.string().nullish(),
});
export type LeverPosting = z.infer<typeof leverPosting>;

const INTERVALS: Record<string, SalaryHint["period"]> = {
  "per-year-salary": "YEAR",
  "per-month-salary": "MONTH",
  "per-week-salary": "WEEK",
  "per-day-wage": "DAY",
  "per-hour-wage": "HOUR",
};

function stripHtmlLite(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export interface LeverConfig {
  site: string;
  employer: EmployerHint;
  rateLimitPerMin?: number;
  fetchImpl?: FetchLike;
}

export class LeverSource implements JobSource {
  readonly descriptor: SourceDescriptor;

  constructor(private readonly cfg: LeverConfig) {
    this.descriptor = {
      key: `lever:${cfg.site}`,
      type: "ATS_PUBLIC_BOARD",
      provider: "lever",
      name: `${cfg.employer.name} — Lever job board`,
      boardToken: cfg.site,
      termsReference: LEVER_TERMS,
      allowedUse:
        "Read the employer's own published postings, show a summary with attribution, and link to the employer's application page.",
      rateLimitPerMin: cfg.rateLimitPerMin ?? 30,
      isDemo: false,
      employerOwned: true,
      employerHint: cfg.employer,
    };
  }

  private opts() {
    return { rateKey: this.descriptor.key, perMinute: this.descriptor.rateLimitPerMin, fetchImpl: this.cfg.fetchImpl };
  }

  async fetch(cursor: string | null): Promise<FetchPage> {
    const skip = cursor ? Number(cursor) : 0;
    const url = `${LEVER_API}/${encodeURIComponent(this.cfg.site)}?mode=json&skip=${skip}&limit=${PAGE_SIZE}`;
    const list = z.array(leverPosting).parse(await politeFetchJson<unknown>(url, this.opts()));
    return {
      postings: list.map((p) => ({ externalRef: p.id, payload: p })),
      nextCursor: list.length === PAGE_SIZE ? String(skip + PAGE_SIZE) : null,
    };
  }

  parse(raw: RawPosting): ParsedPosting {
    const p = leverPosting.parse(raw.payload);
    const sections = (p.lists ?? []).map((l) => `${l.text}\n${stripHtmlLite(l.content)}`);
    const description = [p.descriptionPlain, ...sections, p.additionalPlain, p.salaryDescriptionPlain]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    let salary: SalaryHint | null = null;
    const sr = p.salaryRange;
    if (sr && (sr.min != null || sr.max != null)) {
      const period = sr.interval ? INTERVALS[sr.interval] : undefined;
      const cur = sr.currency ?? "CAD";
      const fmt = (n: number) => n.toLocaleString("en-CA");
      salary = {
        min: sr.min ?? undefined,
        max: sr.max ?? undefined,
        currency: cur,
        period,
        text: `Salary range published on the employer's Lever posting: ${[sr.min, sr.max].filter((x) => x != null).map((x) => fmt(x!)).join("–")} ${cur}${period ? ` (${sr.interval})` : ""}`,
      };
    }

    const location = p.categories?.location ?? p.categories?.allLocations?.join("; ") ?? null;
    return {
      externalRef: p.id,
      title: p.text.trim(),
      employerName: this.cfg.employer.name,
      // Lever gives a separate country code; add it so the normalizer can place the job.
      locationText: location ? (p.country && !/canada/i.test(location) && p.country === "CA" ? `${location}, Canada` : location) : null,
      employmentTypeText: p.categories?.commitment ?? null,
      workplaceTypeText: p.workplaceType && p.workplaceType !== "unspecified" ? p.workplaceType : null,
      descriptionText: description,
      url: p.hostedUrl,
      applyUrl: p.applyUrl ?? p.hostedUrl,
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
      salary,
    };
  }

  async checkLive(externalRef: string): Promise<LiveStatus> {
    const url = `${LEVER_API}/${encodeURIComponent(this.cfg.site)}/${encodeURIComponent(externalRef)}`;
    const checkedAt = new Date();
    try {
      const res = await politeFetch(url, this.opts());
      if (res.ok) return { state: "LIVE", checkedAt, evidenceUrl: url, detail: "Listed on the employer's Lever board" };
      if (res.status === 404) return { state: "GONE", checkedAt, evidenceUrl: url, detail: "No longer on the employer's Lever board" };
      throw new HttpError(res.status, url);
    } catch (e) {
      return { state: "UNKNOWN", checkedAt, evidenceUrl: url, detail: `Could not check: ${(e as Error).message}` };
    }
  }

  probeIdentity(): Promise<IdentityProbe> {
    const s = this.cfg.site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return probeCareersPageLinksBoard(
      this.cfg.employer,
      [new RegExp(`jobs\\.lever\\.co/${s}\\b`, "i"), new RegExp(`api\\.lever\\.co/v0/postings/${s}\\b`, "i")],
      this.opts(),
    );
  }
}
