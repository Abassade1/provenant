import { z } from "zod";
import type { NormalizedPosting } from "./normalize";

const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "must be http(s)");

export const normalizedPostingSchema = z.object({
  externalRef: z.string().min(1).max(200),
  title: z.string().min(2).max(300),
  titleNormalized: z.string().min(1),
  titleStem: z.string().min(1),
  employerName: z.string().min(1).max(300),
  city: z.string().max(120).nullable(),
  province: z.string().length(2).nullable(),
  country: z.enum(["CA", "OTHER", "UNKNOWN"]),
  remoteType: z.enum(["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "SEASONAL", "UNKNOWN"]),
  description: z.string().max(100_000),
  url: httpUrl,
  applyUrl: httpUrl,
  postedAt: z.date().nullable(),
});

export type ValidationResult =
  | { ok: true; posting: NormalizedPosting }
  | { ok: false; skip: true; reason: string } // valid data we deliberately don't index
  | { ok: false; skip: false; reason: string }; // malformed data → ingestion_error

export function validate(p: NormalizedPosting): ValidationResult {
  const r = normalizedPostingSchema.safeParse(p);
  if (!r.success) {
    const reason = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, skip: false, reason };
  }
  // Canada-only index. Remote roles with no stated country are kept; Phase 3 verification flags them.
  if (p.country === "OTHER") return { ok: false, skip: true, reason: "Location is outside Canada" };
  return { ok: true, posting: p };
}
