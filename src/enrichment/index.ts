import type { SalaryHint } from "@/sources/types";

/**
 * The only place AI is allowed (brief §14). Every method is a *fallback* used
 * when deterministic rules find nothing. Outputs are stored as derived, with
 * the model name, and labelled "extracted automatically" in the UI. Nothing
 * here can set a verification status — it only produces inputs.
 *
 * Default implementation is NullEnrichment: the system must work with AI off.
 */
export interface Derived<T> {
  value: T;
  model: string;
  derivedAt: Date;
}

export interface ExtractedPosting {
  title?: string;
  employerName?: string;
  location?: string;
  applyUrl?: string;
  salaryText?: string;
  vacancyStatement?: string;
  contactMethods?: string[];
}

export interface Enrichment {
  readonly enabled: boolean;
  extractSalary(text: string): Promise<Derived<SalaryHint> | null>;
  extractVacancyStatement(text: string): Promise<Derived<string> | null>;
  normalizeTitle(title: string): Promise<Derived<string> | null>;
  parsePastedPosting(text: string): Promise<Derived<ExtractedPosting> | null>;
}

export class NullEnrichment implements Enrichment {
  readonly enabled = false;
  async extractSalary() {
    return null;
  }
  async extractVacancyStatement() {
    return null;
  }
  async normalizeTitle() {
    return null;
  }
  async parsePastedPosting() {
    return null;
  }
}

let current: Enrichment = new NullEnrichment();

export function getEnrichment(): Enrichment {
  return current;
}

/** Swap in an LLM-backed implementation at startup (or a stub in tests). */
export function setEnrichment(e: Enrichment): void {
  current = e;
}
