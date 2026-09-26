import { z } from "zod";

/**
 * Search filters (brief §13). This schema is the single source of truth for
 * both the URL (so a search is shareable/saveable) and a saved search's
 * stored `filters` JSON — the same shape backs both.
 */
export const searchFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  employer: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().length(2).optional(),
  remoteType: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "SEASONAL"]).optional(),
  salaryMin: z.coerce.number().int().positive().optional(),
  status: z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "STALE", "REVIEW_REQUIRED", "HIGH_RISK"]).optional(),
  sourceType: z
    .enum(["ATS_PUBLIC_BOARD", "EMPLOYER_CAREER_PAGE", "GOVERNMENT_OPEN_DATA", "LICENSED_FEED", "EMPLOYER_SUBMITTED", "DEMO"])
    .optional(),
  postedWithinDays: z.coerce.number().int().positive().max(365).optional(),
  confirmedWithinDays: z.coerce.number().int().positive().max(365).optional(),
  sort: z.enum(["relevance", "newest", "confirmed", "salary"]).default("relevance"),
  page: z.coerce.number().int().positive().max(1000).default(1),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

/** Parse a Next.js searchParams object (string | string[] | undefined values). */
export function parseSearchFilters(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const result = searchFiltersSchema.safeParse(flat);
  return result.success ? result.data : searchFiltersSchema.parse({});
}

/** Build a query string from filters, dropping empty/default values — used for shareable links. */
export function filtersToQueryString(f: Partial<SearchFilters>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || (k === "sort" && v === "relevance") || (k === "page" && v === 1)) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
