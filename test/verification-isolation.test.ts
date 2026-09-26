import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { VerificationInput } from "@/verification";

/**
 * Brief §7/§17: payment can never change a signal, status or ranking of
 * verification. Enforced structurally: the verification module can't reach
 * any code outside itself, and its input type has no monetization fields.
 */
const DIR = path.resolve(__dirname, "../src/verification");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

describe("verification module isolation", () => {
  const sources = files(DIR);

  it("has source files", () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  it.each(sources.map((f) => [path.relative(DIR, f), f]))("%s imports only from inside src/verification", (_, file) => {
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3]!;
      expect(spec.startsWith("./"), `${file} imports "${spec}"`).toBe(true);
      expect(path.resolve(path.dirname(file), spec).startsWith(DIR)).toBe(true);
    }
  });

  it.each(sources.map((f) => [path.relative(DIR, f), f]))("%s never mentions monetization", (_, file) => {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // ignore comments
    expect(code).not.toMatch(/\b(plan|billing|sponsor(ed)?|payment_?tier|subscription|paid_?placement|stripe)\b/i);
  });

  it("VerificationInput has no monetization fields", () => {
    type Keys = keyof VerificationInput | keyof VerificationInput["job"] | keyof NonNullable<VerificationInput["employer"]>;
    expectTypeOf<Extract<Keys, "plan" | "sponsored" | "billing" | "tier">>().toEqualTypeOf<never>();
  });
});
