import { createDemoSources } from "./demo";
import { GreenhouseSource } from "./greenhouse";
import { JobBankSource } from "./jobbank";
import { LeverSource } from "./lever";
import boards from "./boards.json";
import type { JobSource } from "./types";

export interface AtsBoardConfig {
  provider: "greenhouse" | "lever";
  /** Greenhouse board token or Lever site name. */
  token: string;
  employer: string;
  /** The employer's own primary domain. */
  domain?: string;
  /** A page on that domain that links to the board (identity evidence). */
  careersUrl?: string;
}

/**
 * All configured sources. ATS boards come from boards.json and are fetched
 * only when listed in ATS_BOARDS (comma-separated "provider:token").
 */
export function configuredSources(env: NodeJS.ProcessEnv = process.env): JobSource[] {
  const sources: JobSource[] = [];
  if (env.ENABLE_DEMO_SOURCE !== "false") sources.push(...createDemoSources());

  const enabled = new Set(
    (env.ATS_BOARDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const b of boards as AtsBoardConfig[]) {
    if (!enabled.has(`${b.provider}:${b.token}`)) continue;
    const employer = { name: b.employer, domain: b.domain, careersUrl: b.careersUrl };
    sources.push(
      b.provider === "greenhouse"
        ? new GreenhouseSource({ boardToken: b.token, employer })
        : new LeverSource({ site: b.token, employer }),
    );
  }
  if (env.JOBBANK_FIXTURE) sources.push(JobBankSource.fromFile(env.JOBBANK_FIXTURE));
  return sources;
}
