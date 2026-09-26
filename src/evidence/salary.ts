import type { SalaryHint } from "@/sources/types";

type Period = NonNullable<SalaryHint["period"]>;

// 85,000 · 85 000 · 85000 · 85K · 41.50 · 41,50 (fr)
const NUM = String.raw`(\d{1,3}(?:[,   ]\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?([kK])?`;
const CUR_BEFORE = String.raw`(?:(?:CAD|CA\$|C\$|USD|US\$)\s?|\$\s?)`;
const CUR_AFTER = String.raw`(?:\s?\$|\s?(?:CAD|USD))`;
const AMOUNT = String.raw`(?:${CUR_BEFORE}${NUM}|${NUM}${CUR_AFTER})`;
const SEP = String.raw`\s*(?:-|–|—|to|and|à|et)\s*`;

const RANGE_RE = new RegExp(`${AMOUNT}${SEP}(?:${AMOUNT}|${NUM})`, "i");
const SINGLE_RE = new RegExp(`(up to|maximum of|max\\.?|starting (?:at|from)|from|minimum of|at least|jusqu'à|à partir de)?\\s*${AMOUNT}`, "i");

const PERIOD_PATTERNS: [RegExp, Period][] = [
  [/\b(per|an|a|\/)\s*(hour|hr|h)\b|\bhourly\b|\bde l['’]heure\b|\bpar heure\b|\/\s?h\b/i, "HOUR"],
  [/\b(per|a|\/)\s*(year|yr|annum)\b|\bannual(ly)?\b|\bpar (année|an)\b|\bannuel(lement)?\b|\/\s?an\b/i, "YEAR"],
  [/\b(per|a|\/)\s*month\b|\bmonthly\b|\bpar mois\b/i, "MONTH"],
  [/\b(per|a|\/)\s*week\b|\bweekly\b|\bpar semaine\b/i, "WEEK"],
  [/\b(per|a|\/)\s*day\b|\bdaily\b|\bpar jour\b/i, "DAY"],
];

function parseNumber(raw: string, k: string | undefined): number {
  let s = raw.replace(/[   ]/g, "");
  // "41,50" (French decimal) vs "85,000" (thousands)
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return k ? n * 1000 : n;
}

function sentenceAround(text: string, index: number, length: number): string {
  const start = Math.max(text.lastIndexOf("\n", index), text.lastIndexOf(". ", index) + 1, 0);
  const endCandidates = [text.indexOf("\n", index + length), text.indexOf(". ", index + length)].filter((i) => i >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) + 1 : text.length;
  const s = text.slice(start, end).trim();
  return s.length > 200 ? s.slice(0, 199).trimEnd() + "…" : s;
}

function inferPeriod(context: string, max: number): Period | undefined {
  for (const [re, p] of PERIOD_PATTERNS) if (re.test(context)) return p;
  if (max < 200) return "HOUR";
  if (max >= 10_000) return "YEAR";
  return undefined;
}

/** Only consider text that talks about pay, so "$5M in funding" isn't read as a salary. */
const PAY_CONTEXT = /\b(salary|salaire|pay|wage|compensation|rémunération|remuneration|rate|taux|base|range|fourchette|per (hour|year|annum)|an hour|a year|hourly|annual|starting at)\b|\/\s?(hr|hour|h|year|yr)\b/i;

/**
 * Deterministic employer-stated salary extraction. Returns null when unsure.
 * Evidence text is the literal sentence the salary came from.
 */
export function extractSalary(text: string): SalaryHint | null {
  if (!text) return null;
  const lines = text.split(/\n+/);
  for (const line of lines) {
    const m = RANGE_RE.exec(line);
    const single = m ? null : SINGLE_RE.exec(line);
    const hit = m ?? single;
    if (!hit) continue;
    const idx = text.indexOf(line) + hit.index;
    const evidence = sentenceAround(text, idx, hit[0].length);
    if (!PAY_CONTEXT.test(evidence)) continue;

    const nums = [...hit[0].matchAll(new RegExp(NUM, "gi"))].map((x) => parseNumber(x[1]!, x[2]));
    if (nums.length === 0 || nums.some((n) => !Number.isFinite(n) || n <= 0)) continue;
    const currency = /USD|US\$/i.test(hit[0]) ? "USD" : "CAD";
    const after = line.slice(hit.index + hit[0].length, hit.index + hit[0].length + 40);
    const context = after + " " + evidence;

    let min: number | undefined;
    let max: number | undefined;
    if (m && nums.length >= 2) {
      [min, max] = [Math.min(nums[0]!, nums[1]!), Math.max(nums[0]!, nums[1]!)];
      // "$85–105K": the K on the second number applies to both.
      if (min < 1000 && max >= 1000 && /[kK]/.test(hit[0]) && max / min > 100) min *= 1000;
    } else {
      const qualifier = (single?.[1] ?? "").toLowerCase();
      if (/up to|max|jusqu/.test(qualifier)) max = nums[0];
      else if (qualifier) min = nums[0];
      else min = max = nums[0];
    }
    const top = max ?? min!;
    // Sanity bounds: below minimum wage-ish hourly or absurd annual → not a salary.
    if (top < 10 || top > 1_000_000) continue;
    return { min, max, currency, period: inferPeriod(context, top), text: evidence };
  }
  return null;
}
