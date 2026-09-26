/**
 * Pairwise similarity for deduplication, behind an interface so an embedding
 * model can replace it later without touching the pipeline.
 */

export interface DedupeSalary {
  min: number | null;
  max: number | null;
  period: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" | null;
  currency: string;
}

export interface DedupeFeatures {
  titleNormalized: string;
  description: string;
  city: string | null;
  province: string | null;
  remoteType: string;
  salary: DedupeSalary | null;
  skills: string[];
  urls: string[];
}

export interface SimilarityResult {
  score: number;
  features: Record<string, number | null>;
}

export interface SimilarityScorer {
  readonly name: string;
  score(a: DedupeFeatures, b: DedupeFeatures): SimilarityResult;
}

export const MERGE_THRESHOLD = 0.85;
export const REVIEW_THRESHOLD = 0.6;

// ── Helpers ─────────────────────────────────────────────────────────────────

const DEMO_BOILERPLATE = /this is a fictional demo posting\.?|posted via [^.\n]+\(demo\)\.?/gi;

function tokens(s: string): string[] {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(DEMO_BOILERPLATE, " ")
    .replace(/[^a-z0-9$]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** k-word shingles. Descriptions are short enough that exact Jaccard is cheap within a block. */
export function shingles(text: string, k = 4): Set<string> {
  const t = tokens(text);
  const out = new Set<string>();
  if (t.length < k) {
    if (t.length) out.add(t.join(" "));
    return out;
  }
  for (let i = 0; i + k <= t.length; i++) out.add(t.slice(i, i + k).join(" "));
  return out;
}

const HOURS: Record<string, number> = { HOUR: 1, DAY: 8, WEEK: 40, MONTH: 2080 / 12, YEAR: 2080 };

function annual(s: DedupeSalary): [number, number] | null {
  if (!s.period || (s.min == null && s.max == null)) return null;
  const k = 2080 / HOURS[s.period]!;
  return [(s.min ?? s.max)! * k, (s.max ?? s.min)! * k];
}

/** Overlap of two salary ranges as intersection / union (1 = identical). */
export function salaryOverlap(a: DedupeSalary, b: DedupeSalary): number | null {
  if (a.currency !== b.currency) return null;
  const ra = annual(a);
  const rb = annual(b);
  if (!ra || !rb) return null;
  const inter = Math.max(0, Math.min(ra[1], rb[1]) - Math.max(ra[0], rb[0]));
  const union = Math.max(ra[1], rb[1]) - Math.min(ra[0], rb[0]);
  if (union === 0) return ra[0] === rb[0] ? 1 : 0;
  return inter / union;
}

function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function locationScore(a: DedupeFeatures, b: DedupeFeatures): number {
  const ca = a.city?.toLowerCase() ?? null;
  const cb = b.city?.toLowerCase() ?? null;
  if (ca && cb) return ca === cb && a.province === b.province ? 1 : 0;
  if (!ca && !cb) return a.remoteType === b.remoteType ? 1 : 0.5;
  return a.province && a.province === b.province ? 0.5 : 0;
}

// ── Default scorer ──────────────────────────────────────────────────────────

const WEIGHTS = { title: 0.25, description: 0.35, location: 0.15, salary: 0.1, skills: 0.05, url: 0.1 };

export const lexicalScorer: SimilarityScorer = {
  name: "lexical-v1",
  score(a, b) {
    const features: Record<string, number | null> = {
      title: jaccard(new Set(tokens(a.titleNormalized)), new Set(tokens(b.titleNormalized))),
      description: a.description && b.description ? jaccard(shingles(a.description), shingles(b.description)) : null,
      location: locationScore(a, b),
      salary: a.salary && b.salary ? salaryOverlap(a.salary, b.salary) : null,
      skills: a.skills.length && b.skills.length
        ? jaccard(new Set(a.skills.map((s) => s.toLowerCase())), new Set(b.skills.map((s) => s.toLowerCase())))
        : null,
      // A shared URL is strong positive evidence; a mismatch says nothing on its
      // own (different sources host applications differently) — the dedupe
      // guards, not this score, are what judge whether an apply link is
      // trustworthy enough to merge on.
      url: a.urls.some((u) => b.urls.map(normUrl).includes(normUrl(u))) ? 1 : null,
    };
    let total = 0;
    let weight = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) {
      const v = features[k];
      if (v == null) continue; // missing features don't count for or against
      total += v * w;
      weight += w;
    }
    let score = weight ? total / weight : 0;
    // The same posting URL is the strongest possible evidence of the same job.
    if (features.url === 1) score = Math.max(score, 0.95);
    // A different city is never the same job, however similar the text.
    if (features.location === 0) score = Math.min(score, REVIEW_THRESHOLD - 0.01);
    return { score: Math.round(score * 10_000) / 10_000, features };
  },
};

let scorer: SimilarityScorer = lexicalScorer;
export const getScorer = () => scorer;
export const setScorer = (s: SimilarityScorer) => {
  scorer = s;
};
