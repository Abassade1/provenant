/**
 * Fictional employers and jobs for the DEMO connector.
 *
 * Rules (brief §5.3): every name is invented, every domain uses the reserved
 * `.example` TLD (RFC 2606) so it can never resolve to a real organization.
 */

export interface DemoEmployer {
  slug: string;
  name: string;
  domain: string;
  /** Whether the demo careers page "links" to the demo board (drives identity in Phase 3). */
  careersLinksBoard: boolean;
}

export const DEMO_EMPLOYERS: DemoEmployer[] = [
  { slug: "northwind-labs", name: "Northwind Labs", domain: "northwindlabs.example", careersLinksBoard: true },
  { slug: "borealis-freight", name: "Borealis Freight", domain: "borealisfreight.example", careersLinksBoard: true },
  { slug: "tamarack-health", name: "Tamarack Health Collective", domain: "tamarackhealth.example", careersLinksBoard: true },
  { slug: "lakeshore-credit", name: "Lakeshore Credit Union", domain: "lakeshorecu.example", careersLinksBoard: true },
  { slug: "prairie-grid", name: "Prairie Grid Energy", domain: "prairiegrid.example", careersLinksBoard: false },
  { slug: "saltmarsh-studio", name: "Saltmarsh Studio", domain: "saltmarsh.example", careersLinksBoard: true },
  { slug: "cedarline-foods", name: "Cedarline Foods", domain: "cedarline.example", careersLinksBoard: false },
  { slug: "fjord-robotics", name: "Fjord Robotics", domain: "fjordrobotics.example", careersLinksBoard: true },
];

const CITIES: [string, string][] = [
  ["Toronto", "ON"],
  ["Ottawa", "ON"],
  ["Waterloo", "ON"],
  ["Montréal", "QC"],
  ["Vancouver", "BC"],
  ["Victoria", "BC"],
  ["Calgary", "AB"],
  ["Edmonton", "AB"],
  ["Winnipeg", "MB"],
  ["Halifax", "NS"],
  ["Saskatoon", "SK"],
];

interface RoleTemplate {
  title: string;
  skills: string[];
  salary: [number, number, "YEAR" | "HOUR"] | null;
  type: string;
}

const ROLES: RoleTemplate[] = [
  { title: "Software Developer", skills: ["TypeScript", "React", "PostgreSQL"], salary: [85000, 105000, "YEAR"], type: "Full-time" },
  { title: "Senior Backend Engineer", skills: ["Go", "Kubernetes", "PostgreSQL"], salary: [125000, 150000, "YEAR"], type: "Full-time" },
  { title: "Data Analyst", skills: ["SQL", "Python", "Tableau"], salary: [68000, 82000, "YEAR"], type: "Full-time" },
  { title: "Registered Nurse – Medical/Surgical", skills: ["Patient care", "CNO registration"], salary: [41.5, 58.2, "HOUR"], type: "Full-time" },
  { title: "Warehouse Associate", skills: ["Forklift", "Inventory"], salary: [19.5, 22, "HOUR"], type: "Part-time" },
  { title: "Customer Service Representative", skills: ["Bilingual (English/French)", "CRM"], salary: [45000, 52000, "YEAR"], type: "Full-time" },
  { title: "Product Designer", skills: ["Figma", "User research"], salary: null, type: "Full-time" },
  { title: "Electrical Technologist", skills: ["AutoCAD", "SCADA"], salary: [72000, 90000, "YEAR"], type: "Full-time" },
  { title: "Marketing Coordinator", skills: ["Content", "Google Analytics"], salary: [52000, 60000, "YEAR"], type: "Contract" },
  { title: "Line Cook", skills: ["Food safety"], salary: [18, 21, "HOUR"], type: "Part-time" },
  { title: "IT Support Specialist", skills: ["Windows", "Microsoft 365", "Networking"], salary: [55000, 65000, "YEAR"], type: "Full-time" },
  { title: "Financial Analyst", skills: ["Excel", "Forecasting"], salary: null, type: "Full-time" },
];

const WORKPLACE = ["On-site", "Hybrid", "Remote"] as const;

export interface DemoJob {
  externalRef: string;
  employerSlug: string;
  title: string;
  city: string;
  province: string;
  workplace: (typeof WORKPLACE)[number];
  employmentType: string;
  skills: string[];
  salaryText: string | null;
  vacancyStatement: string | null;
  postedDaysAgo: number;
  description: string;
}

function money(n: number, period: "YEAR" | "HOUR") {
  return period === "YEAR" ? `$${n.toLocaleString("en-CA")}` : `$${n.toFixed(2)}`;
}

/** Deterministic PRNG so the demo set is identical on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoJobs(count = 60): DemoJob[] {
  const rand = mulberry32(20260926);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const jobs: DemoJob[] = [];
  for (let i = 0; i < count; i++) {
    const emp = DEMO_EMPLOYERS[i % DEMO_EMPLOYERS.length]!;
    const role = pick(ROLES);
    const [city, province] = pick(CITIES);
    const workplace = pick(WORKPLACE);
    const salaryText = role.salary
      ? `${money(role.salary[0], role.salary[2])}–${money(role.salary[1], role.salary[2])} per ${role.salary[2] === "YEAR" ? "year" : "hour"}`
      : null;
    const vacancyStatement =
      province === "ON"
        ? rand() < 0.8
          ? "This posting is for an existing vacancy."
          : "This posting is not for an existing vacancy; we are building a pool of candidates for future openings."
        : null;
    const description = [
      `${emp.name} is hiring a ${role.title} (${workplace}) in ${city}, ${province}.`,
      `What you'll do: work with a small team, own your projects end to end, and help customers.`,
      `What you bring: ${role.skills.join(", ")}.`,
      salaryText ? `Compensation: ${salaryText}.` : "",
      vacancyStatement ?? "",
      `This is a fictional demo posting.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    jobs.push({
      externalRef: `demo-${String(i + 1).padStart(3, "0")}`,
      employerSlug: emp.slug,
      title: role.title,
      city,
      province,
      workplace,
      employmentType: role.type,
      skills: role.skills,
      salaryText,
      vacancyStatement,
      postedDaysAgo: Math.floor(rand() * 30),
      description,
    });
  }
  return jobs;
}
