/**
 * Finds the posting's own statement about whether it's for an existing
 * vacancy (Ontario ESA disclosure, in force Jan 1, 2026). Returns the literal
 * sentence; we quote it and never judge compliance.
 */
const VACANCY_RE =
  /[^.\n]*\b(existing vacancy|existing position|current vacancy|currently vacant|pool of (candidates|applicants)|future (openings|opportunities|vacancies)|talent (pool|community)|poste vacant|vacance existante|poste existant)\b[^.\n]*\.?/i;

export function extractVacancyStatement(text: string): string | null {
  const m = VACANCY_RE.exec(text);
  if (!m) return null;
  const s = m[0].replace(/\s+/g, " ").trim();
  return s.length > 300 ? s.slice(0, 299) + "…" : s;
}
