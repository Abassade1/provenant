import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { FetchPage, JobSource, LiveStatus, ParsedPosting, RawPosting, SourceDescriptor } from "../types";

/**
 * Job Bank (ESDC) — GOVERNMENT_OPEN_DATA connector.
 *
 * STATUS: runs against a local file only. The record shape below is an
 * ASSUMED, simplified shape pending confirmation of the actual open dataset
 * (fields, update frequency and licence). See docs/sources.md. Swap `load`
 * for the real dataset reader once confirmed — `parse` is the only other
 * place that knows the shape.
 */
const record = z.object({
  jobId: z.string(),
  title: z.string(),
  employerName: z.string(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  workplace: z.string().nullish(),
  employmentType: z.string().nullish(),
  salaryText: z.string().nullish(),
  datePosted: z.string().nullish(),
  description: z.string().nullish(),
});
export type JobBankRecord = z.infer<typeof record>;

export const JOBBANK_POSTING_URL = "https://www.jobbank.gc.ca/jobsearch/jobposting/";

export class JobBankSource implements JobSource {
  readonly descriptor: SourceDescriptor = {
    key: "jobbank:open-data",
    type: "GOVERNMENT_OPEN_DATA",
    provider: "jobbank",
    name: "Job Bank (Government of Canada)",
    termsReference:
      "Open Government Licence – Canada (https://open.canada.ca/en/open-government-licence-canada) — TO CONFIRM for the specific Job Bank dataset.",
    allowedUse: "Pending confirmation. Currently used only with a local fixture, never fetched.",
    rateLimitPerMin: 60,
    isDemo: false,
    employerOwned: false,
  };

  constructor(private readonly load: () => Promise<unknown>) {}

  static fromFile(path: string): JobBankSource {
    return new JobBankSource(async () => JSON.parse(await readFile(path, "utf8")));
  }

  async fetch(): Promise<FetchPage> {
    const rows = z.array(record).parse(await this.load());
    return { postings: rows.map((r) => ({ externalRef: r.jobId, payload: r })), nextCursor: null };
  }

  parse(raw: RawPosting): ParsedPosting {
    const r = record.parse(raw.payload);
    const url = JOBBANK_POSTING_URL + encodeURIComponent(r.jobId);
    return {
      externalRef: r.jobId,
      title: r.title,
      employerName: r.employerName,
      locationText: [r.city, r.province].filter(Boolean).join(", ") || null,
      employmentTypeText: r.employmentType ?? null,
      workplaceTypeText: r.workplace ?? null,
      descriptionText: [r.description, r.salaryText ? `Salary: ${r.salaryText}` : null].filter(Boolean).join("\n\n"),
      url,
      applyUrl: url, // Job Bank lists how to apply on the posting page
      postedAt: r.datePosted ? new Date(r.datePosted) : null,
      salary: null, // parsed from text by the EXTRACT_SALARY stage
    };
  }

  async checkLive(): Promise<LiveStatus> {
    return {
      state: "UNKNOWN",
      checkedAt: new Date(),
      detail: "Job Bank open data is a periodic extract, so we can't confirm a posting is still listed.",
    };
  }
}
