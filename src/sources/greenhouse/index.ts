import { z } from "zod";
import { HttpError, politeFetch, politeFetchJson, type FetchLike } from "@/lib/http";
import { decodeEntities, htmlToText } from "@/lib/text";
import { probeCareersPageLinksBoard } from "../identity-probe";
import type { EmployerHint, FetchPage, IdentityProbe, JobSource, LiveStatus, ParsedPosting, RawPosting, SourceDescriptor } from "../types";

/**
 * Greenhouse Job Board API — public, unauthenticated GET endpoints that
 * employers use to publish their own postings.
 * Docs: https://developers.greenhouse.io/job-board.html
 */
export const GREENHOUSE_API = "https://boards-api.greenhouse.io/v1/boards";
export const GREENHOUSE_TERMS =
  "https://developers.greenhouse.io/job-board.html (Job Board API: public GET endpoints, no key required). " +
  "Aggregation across employers is not explicitly addressed — see docs/sources.md.";

const ghJob = z.object({
  id: z.number(),
  title: z.string(),
  updated_at: z.string().nullish(),
  first_published: z.string().nullish(),
  absolute_url: z.string().url(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  content: z.string().nullish(),
  metadata: z
    .array(z.object({ name: z.string(), value: z.unknown() }))
    .nullish(),
  offices: z.array(z.object({ name: z.string().nullish(), location: z.string().nullish() })).nullish(),
});
export type GreenhouseJob = z.infer<typeof ghJob>;

const ghList = z.object({ jobs: z.array(ghJob) });

export interface GreenhouseConfig {
  boardToken: string;
  employer: EmployerHint;
  rateLimitPerMin?: number;
  fetchImpl?: FetchLike;
}

function metaValue(job: GreenhouseJob, pattern: RegExp): string | null {
  const m = job.metadata?.find((x) => pattern.test(x.name));
  if (!m || m.value == null) return null;
  if (typeof m.value === "string") return m.value;
  if (Array.isArray(m.value)) return m.value.join(", ");
  if (typeof m.value === "object" && "value" in (m.value as object)) {
    return String((m.value as { value: unknown }).value);
  }
  return String(m.value);
}

export class GreenhouseSource implements JobSource {
  readonly descriptor: SourceDescriptor;
  private readonly fetchImpl?: FetchLike;

  constructor(private readonly cfg: GreenhouseConfig) {
    this.fetchImpl = cfg.fetchImpl;
    this.descriptor = {
      key: `greenhouse:${cfg.boardToken}`,
      type: "ATS_PUBLIC_BOARD",
      provider: "greenhouse",
      name: `${cfg.employer.name} — Greenhouse job board`,
      boardToken: cfg.boardToken,
      termsReference: GREENHOUSE_TERMS,
      allowedUse:
        "Read the employer's own published postings, show a summary with attribution, and link to the employer's application page.",
      rateLimitPerMin: cfg.rateLimitPerMin ?? 30,
      isDemo: false,
      employerOwned: true,
      employerHint: cfg.employer,
    };
  }

  private opts() {
    return {
      rateKey: this.descriptor.key,
      perMinute: this.descriptor.rateLimitPerMin,
      fetchImpl: this.fetchImpl,
    };
  }

  async fetch(_cursor: string | null): Promise<FetchPage> {
    // The board endpoint returns every open job in one response; no pagination.
    const url = `${GREENHOUSE_API}/${encodeURIComponent(this.cfg.boardToken)}/jobs?content=true`;
    const body = ghList.parse(await politeFetchJson<unknown>(url, this.opts()));
    return {
      postings: body.jobs.map((j) => ({ externalRef: String(j.id), payload: j })),
      nextCursor: null,
    };
  }

  parse(raw: RawPosting): ParsedPosting {
    const job = ghJob.parse(raw.payload);
    const officeLocations = (job.offices ?? []).map((o) => o.location ?? o.name).filter(Boolean);
    return {
      externalRef: String(job.id),
      title: job.title.trim(),
      employerName: job.company_name?.trim() || this.cfg.employer.name,
      locationText: job.location?.name?.trim() || officeLocations.join("; ") || null,
      employmentTypeText: metaValue(job, /employment|job type|commitment/i),
      workplaceTypeText: metaValue(job, /workplace|remote|location type/i),
      // `content` is entity-escaped HTML ("&lt;p&gt;…"), so decode once before stripping tags.
      descriptionText: job.content ? htmlToText(decodeEntities(job.content)) : "",
      url: job.absolute_url,
      applyUrl: job.absolute_url, // Greenhouse hosts the application form on the posting page
      postedAt: job.first_published ? new Date(job.first_published) : null,
      salary: null, // extracted from description text in the EXTRACT_SALARY stage
    };
  }

  async checkLive(externalRef: string): Promise<LiveStatus> {
    const url = `${GREENHOUSE_API}/${encodeURIComponent(this.cfg.boardToken)}/jobs/${encodeURIComponent(externalRef)}`;
    const checkedAt = new Date();
    try {
      const res = await politeFetch(url, this.opts());
      if (res.ok) return { state: "LIVE", checkedAt, evidenceUrl: url, detail: "Listed on the employer's Greenhouse board" };
      if (res.status === 404) return { state: "GONE", checkedAt, evidenceUrl: url, detail: "No longer on the employer's Greenhouse board" };
      throw new HttpError(res.status, url);
    } catch (e) {
      return { state: "UNKNOWN", checkedAt, evidenceUrl: url, detail: `Could not check: ${(e as Error).message}` };
    }
  }

  probeIdentity(): Promise<IdentityProbe> {
    const t = this.cfg.boardToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return probeCareersPageLinksBoard(
      this.cfg.employer,
      [
        new RegExp(`(job-)?boards(-api)?\\.greenhouse\\.io/(v1/boards/)?${t}\\b`, "i"),
        new RegExp(`greenhouse\\.io/embed/job_board(/js)?\\?for=${t}\\b`, "i"),
      ],
      this.opts(),
    );
  }
}
