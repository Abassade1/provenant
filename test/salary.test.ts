import { describe, expect, it } from "vitest";
import { extractSalary } from "@/evidence/salary";
import { extractVacancyStatement } from "@/evidence/vacancy";

describe("extractSalary (employer-stated, deterministic)", () => {
  it.each([
    ["The salary range for this role is $120,000 - $145,000 CAD per year.", 120000, 145000, "CAD", "YEAR"],
    ["Compensation: $85,000–$105,000 per year.", 85000, 105000, "CAD", "YEAR"],
    ["Compensation: $41.50–$58.20 per hour.", 41.5, 58.2, "CAD", "HOUR"],
    ["Pay: $85K–$105K", 85000, 105000, "CAD", "YEAR"],
    ["Base pay range $85-105K USD", 85000, 105000, "USD", "YEAR"],
    ["Salaire : 85 000 $ à 105 000 $ par année", 85000, 105000, "CAD", "YEAR"],
    ["Taux horaire : 19,50 $ de l'heure", 19.5, 19.5, "CAD", "HOUR"],
    ["Hourly rate: $22", 22, 22, "CAD", "HOUR"],
    ["Pay: $27.50 - $31.00 per hour.", 27.5, 31, "CAD", "HOUR"],
  ])("%s", (text, min, max, currency, period) => {
    expect(extractSalary(text)).toMatchObject({ min, max, currency, period });
  });

  it("keeps open-ended ranges open", () => {
    expect(extractSalary("Salary: up to $70,000 annually")).toMatchObject({ min: undefined, max: 70000, period: "YEAR" });
    expect(extractSalary("Starting at $20/hr")).toMatchObject({ min: 20, max: undefined, period: "HOUR" });
  });

  it.each([
    "We raised $5,000,000 in 2024.",
    "Experience: 3-5 years",
    "Serving 120,000 - 145,000 customers a year.",
    "",
  ])("ignores non-salary numbers: %s", (text) => {
    expect(extractSalary(text)).toBeNull();
  });

  it("quotes the sentence the salary came from", () => {
    const s = extractSalary("We build tools.\n\nThe salary range for this role is $120,000 - $145,000 CAD per year.\n\nApply now.");
    expect(s?.text).toBe("The salary range for this role is $120,000 - $145,000 CAD per year.");
  });
});

describe("extractVacancyStatement", () => {
  it.each([
    ["Great team.\nThis posting is for an existing vacancy.\nApply today.", "This posting is for an existing vacancy."],
    ["We are building a pool of candidates for future openings.", "We are building a pool of candidates for future openings."],
    ["Ce poste vise à pourvoir un poste vacant existant.", "Ce poste vise à pourvoir un poste vacant existant."],
  ])("%s", (text, expected) => {
    expect(extractVacancyStatement(text)).toBe(expected);
  });
  it("returns null when there's no statement", () => {
    expect(extractVacancyStatement("A normal job description.")).toBeNull();
  });
});
