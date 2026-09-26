import type { ParsedPosting, SalaryHint } from "@/sources/types";

export type RemoteType = "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN";
export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERNSHIP"
  | "SEASONAL"
  | "UNKNOWN";
export type Country = "CA" | "OTHER" | "UNKNOWN";

export interface NormalizedPosting {
  externalRef: string;
  title: string;
  titleNormalized: string;
  titleStem: string;
  employerName: string;
  locationText: string | null;
  city: string | null;
  province: string | null;
  country: Country;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  description: string;
  url: string;
  applyUrl: string;
  postedAt: Date | null;
  salary: SalaryHint | null;
}

// ── Title ───────────────────────────────────────────────────────────────────

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bsr\.?(?=\s|$)/g, "senior"],
  [/\bjr\.?(?=\s|$)/g, "junior"],
  [/\bmgr\b/g, "manager"],
  [/\beng\b/g, "engineer"],
  [/\bdev\b/g, "developer"],
  [/\bswe\b/g, "software engineer"],
  [/\bqa\b/g, "quality assurance"],
  [/\brn\b/g, "registered nurse"],
  [/\bassoc\b/g, "associate"],
  [/\badmin\b/g, "administrator"],
  [/\bcoord\b/g, "coordinator"],
];

const SENIORITY = new Set([
  "senior", "junior", "lead", "principal", "staff", "intermediate", "entry", "level",
  "i", "ii", "iii", "iv", "1", "2", "3", "head", "chief",
]);
const NOISE = new Set(["remote", "hybrid", "onsite", "on-site", "contract", "temporary", "full", "part", "time", "canada", "f", "m", "h", "x"]);

export function normalizeTitle(title: string): { normalized: string; stem: string } {
  let t = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // drop parentheticals: "(Remote)", "[Contract]"
    .replace(/[–—]/g, "-");
  // Drop trailing " - location/team" qualifiers: "Software Developer - Toronto"
  t = t.replace(/\s+[-|,/]\s+.*$/, "");
  t = t.replace(/[^a-z0-9+#.\s-]/g, " ");
  for (const [re, rep] of ABBREVIATIONS) t = t.replace(re, rep);
  const normalized = t.replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();
  const stem = normalized
    .split(" ")
    .filter((w) => w && !SENIORITY.has(w) && !NOISE.has(w))
    .join(" ");
  return { normalized, stem: stem || normalized };
}

// ── Location ────────────────────────────────────────────────────────────────

const PROVINCES: Record<string, string> = {
  AB: "alberta", BC: "british columbia", MB: "manitoba", NB: "new brunswick",
  NL: "newfoundland and labrador", NS: "nova scotia", NT: "northwest territories",
  NU: "nunavut", ON: "ontario", PE: "prince edward island", QC: "quebec",
  SK: "saskatchewan", YT: "yukon",
};
const PROVINCE_BY_NAME = new Map<string, string>([
  ...Object.entries(PROVINCES).map(([code, name]) => [name, code] as [string, string]),
  ["newfoundland", "NL"], ["pei", "PE"], ["québec", "QC"], ["yukon territory", "YT"],
]);
// Well-known cities, so "Toronto" alone resolves. Not exhaustive by design.
const CITY_PROVINCE: Record<string, string> = {
  toronto: "ON", ottawa: "ON", mississauga: "ON", brampton: "ON", hamilton: "ON", london: "ON",
  waterloo: "ON", kitchener: "ON", markham: "ON", vaughan: "ON", oakville: "ON", burlington: "ON",
  montreal: "QC", "quebec city": "QC", laval: "QC", gatineau: "QC", sherbrooke: "QC",
  vancouver: "BC", victoria: "BC", burnaby: "BC", surrey: "BC", richmond: "BC", kelowna: "BC",
  calgary: "AB", edmonton: "AB", winnipeg: "MB", regina: "SK", saskatoon: "SK",
  halifax: "NS", fredericton: "NB", moncton: "NB", "st. john's": "NL", charlottetown: "PE",
  whitehorse: "YT", yellowknife: "NT", iqaluit: "NU",
};
// Cities whose name is shared with a place outside Canada; only count them with a Canadian qualifier.
const AMBIGUOUS_CITIES = new Set(["london", "richmond", "victoria", "surrey", "hamilton", "waterloo"]);

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);
const NON_CA_COUNTRIES =
  /\b(united states|usa|u\.s\.|united kingdom|uk|england|ireland|germany|france|india|mexico|brazil|australia|netherlands|spain|poland|singapore|japan|philippines)\b/i;

function stripAccents(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export interface ParsedLocation {
  city: string | null;
  province: string | null;
  country: Country;
  remoteHint: RemoteType;
}

export function parseLocation(text: string | null): ParsedLocation {
  if (!text?.trim()) return { city: null, province: null, country: "UNKNOWN", remoteHint: "UNKNOWN" };
  const raw = text.trim();
  const lower = stripAccents(raw).toLowerCase();
  const remoteHint: RemoteType = /\bhybrid\b/.test(lower)
    ? "HYBRID"
    : /\b(remote|work from home|wfh|anywhere)\b/.test(lower)
      ? "REMOTE"
      : "UNKNOWN";

  // Consider only the first location when several are listed ("Toronto, ON; Vancouver, BC").
  const first = raw.split(/;|\s\/\s|\bor\b/)[0]!;
  const parts = first
    .replace(/\b(remote|hybrid|on-?site)\b/gi, "")
    .replace(/[()]/g, ",")
    .split(/[,\-–|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  let province: string | null = null;
  let city: string | null = null;
  let explicitCanada = /\bcanada\b/i.test(raw);
  for (const p of parts) {
    const up = p.toUpperCase();
    const pl = stripAccents(p).toLowerCase();
    if (!province && PROVINCES[up]) province = up;
    else if (!province && PROVINCE_BY_NAME.has(pl)) province = PROVINCE_BY_NAME.get(pl)!;
  }
  for (const p of parts) {
    const pl = stripAccents(p).toLowerCase();
    if (pl === "canada" || PROVINCES[p.toUpperCase()] || PROVINCE_BY_NAME.has(pl)) continue;
    if (US_STATES.has(p.toUpperCase()) && p.length === 2) continue;
    city = p;
    break;
  }
  const cityKey = city ? stripAccents(city).toLowerCase() : null;
  if (!province && cityKey && CITY_PROVINCE[cityKey] && !AMBIGUOUS_CITIES.has(cityKey)) {
    province = CITY_PROVINCE[cityKey]!;
  }

  const looksForeign =
    NON_CA_COUNTRIES.test(raw) ||
    (!province && parts.some((p) => p.length === 2 && US_STATES.has(p.toUpperCase())));
  let country: Country = "UNKNOWN";
  if (province || explicitCanada) country = "CA";
  else if (looksForeign) country = "OTHER";
  if (explicitCanada && looksForeign && !province) country = "CA"; // "Remote — Canada or USA"

  return { city: city && cityKey !== "canada" ? city : null, province, country, remoteHint };
}

// ── Workplace & employment type ─────────────────────────────────────────────

export function normalizeRemote(workplace: string | null, location: ParsedLocation, description: string): RemoteType {
  const w = (workplace ?? "").toLowerCase();
  if (/hybrid/.test(w)) return "HYBRID";
  if (/remote/.test(w)) return "REMOTE";
  if (/on-?site|in[- ]office|in person/.test(w)) return "ONSITE";
  if (location.remoteHint !== "UNKNOWN") return location.remoteHint;
  // Last resort: an explicit statement in the first part of the description.
  const head = description.slice(0, 600).toLowerCase();
  if (/\bthis (is a|role is) (fully )?remote\b/.test(head)) return "REMOTE";
  if (/\bthis (is a|role is) hybrid\b/.test(head)) return "HYBRID";
  if (location.city) return "ONSITE";
  return "UNKNOWN";
}

export function normalizeEmploymentType(text: string | null, title: string): EmploymentType {
  const s = `${text ?? ""} ${title}`.toLowerCase();
  if (/intern(ship)?|co-?op\b|student/.test(s)) return "INTERNSHIP";
  if (/seasonal|summer/.test(s) && !/full/.test(text?.toLowerCase() ?? "")) return "SEASONAL";
  if (/contract|contractor|freelance|fixed[- ]term/.test(s)) return "CONTRACT";
  if (/temp(orary)?\b/.test(s)) return "TEMPORARY";
  if (/part[- ]?time/.test(s)) return "PART_TIME";
  if (/full[- ]?time|permanent|regular/.test(s)) return "FULL_TIME";
  return "UNKNOWN";
}

// ── Stage ───────────────────────────────────────────────────────────────────

export function normalize(p: ParsedPosting): NormalizedPosting {
  const { normalized, stem } = normalizeTitle(p.title);
  const loc = parseLocation(p.locationText);
  return {
    externalRef: p.externalRef,
    title: p.title.replace(/\s+/g, " ").trim(),
    titleNormalized: normalized,
    titleStem: stem,
    employerName: p.employerName.trim(),
    locationText: p.locationText,
    city: loc.city,
    province: loc.province,
    country: loc.country,
    remoteType: normalizeRemote(p.workplaceTypeText, loc, p.descriptionText),
    employmentType: normalizeEmploymentType(p.employmentTypeText, p.title),
    description: p.descriptionText,
    url: p.url,
    applyUrl: p.applyUrl ?? p.url,
    postedAt: p.postedAt,
    salary: p.salary,
  };
}
