import { getEnrichment } from "@/enrichment";
import { extractSalary } from "@/evidence/salary";
import { extractVacancyStatement } from "@/evidence/vacancy";
import type { ParsedPosting } from "@/sources/types";
import type { NormalizedPosting } from "./normalize";
import type { ExtractedEvidence } from "./upsert";

/**
 * EXTRACT_SALARY stage (also extracts the vacancy statement and skills).
 * Order: structured data from the source → deterministic parser → optional
 * AI fallback (stored as derived, with model name). Never estimates.
 */
export async function extractEvidence(parsed: ParsedPosting, p: NormalizedPosting): Promise<ExtractedEvidence> {
  const enrichment = getEnrichment();

  let salary = parsed.salary && (parsed.salary.min != null || parsed.salary.max != null) ? parsed.salary : null;
  let salaryDerived: ExtractedEvidence["salaryDerived"] = null;
  if (!salary) salary = extractSalary([parsed.salary?.text, p.description].filter(Boolean).join("\n"));
  if (!salary && enrichment.enabled) {
    const d = await enrichment.extractSalary(p.description);
    if (d) {
      salary = d.value;
      salaryDerived = { model: d.model };
    }
  }

  let vacancyStatement = extractVacancyStatement(p.description);
  let vacancyDerived = false;
  if (!vacancyStatement && enrichment.enabled) {
    const d = await enrichment.extractVacancyStatement(p.description);
    // Only accept a statement that literally appears in the posting — we quote, never paraphrase.
    if (d && p.description.includes(d.value)) {
      vacancyStatement = d.value;
      vacancyDerived = true;
    }
  }

  return { salary, salaryDerived, vacancyStatement, vacancyDerived, skills: parsed.skills ?? [] };
}
