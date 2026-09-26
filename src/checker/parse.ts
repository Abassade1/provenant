import { extractSalary } from "@/evidence/salary";
import { extractVacancyStatement } from "@/evidence/vacancy";
import { findOffPlatformContact, findUpfrontPayment } from "@/verification/patterns";
import type { SalaryHint } from "@/sources/types";

export interface ExtractedCheckFields {
  title: string | null;
  employerName: string | null;
  location: string | null;
  applyUrl: string | null;
  salary: SalaryHint | null;
  vacancyStatement: string | null;
  offPlatformContact: boolean;
  upfrontPayment: boolean;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
const TITLE_LINE_RE = /^(job title|position|role|title)\s*[:\-]\s*(.+)$/im;
const LOCATION_LINE_RE = /^(location|based in|city)\s*[:\-]\s*(.+)$/im;
const EMPLOYER_LINE_RE = /^(company|employer|organization|organisation)\s*[:\-]\s*(.+)$/im;
const APPLY_WORD_RE = /\b(apply|application|apply here|apply now|apply at)\b/i;

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length > 2 && t.length < 150) return t;
  }
  return null;
}

/** Prefer a URL introduced near the word "apply"; otherwise the first URL. */
function pickApplyUrl(text: string): string | null {
  const urls = [...text.matchAll(URL_RE)].map((m) => ({ url: m[0].replace(/[.,;]+$/, ""), index: m.index! }));
  if (urls.length === 0) return null;
  let best = urls[0]!;
  let bestDistance = Infinity;
  for (const m of text.matchAll(/\b(apply|application)\b/gi)) {
    for (const u of urls) {
      const d = Math.abs(u.index - m.index!);
      if (d < bestDistance) {
        bestDistance = d;
        best = u;
      }
    }
  }
  return best.url;
}

/**
 * Deterministic extraction from pasted text (a posting, an email, or a
 * message). Labelled fields ("Title:", "Location:") are used when present;
 * otherwise we fall back to light heuristics. Returns null for anything we
 * can't find with confidence — the caller never invents a value.
 */
export function extractFromText(text: string, employerHint?: string): ExtractedCheckFields {
  const titleMatch = TITLE_LINE_RE.exec(text);
  const employerMatch = EMPLOYER_LINE_RE.exec(text);
  const locationMatch = LOCATION_LINE_RE.exec(text);

  return {
    title: titleMatch?.[2]?.trim() ?? firstNonEmptyLine(text),
    employerName: employerHint?.trim() || employerMatch?.[2]?.trim() || null,
    location: locationMatch?.[2]?.trim() ?? null,
    applyUrl: APPLY_WORD_RE.test(text) || URL_RE.test(text) ? pickApplyUrl(text) : null,
    salary: extractSalary(text),
    vacancyStatement: extractVacancyStatement(text),
    offPlatformContact: findOffPlatformContact(text).length > 0,
    upfrontPayment: findUpfrontPayment(text).length > 0,
  };
}
