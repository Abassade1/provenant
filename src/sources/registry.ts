import { createDemoSources } from "./demo";
import { GreenhouseSource } from "./greenhouse";
import boards from "./greenhouse/boards.json";
import type { JobSource } from "./types";

export interface GreenhouseBoardConfig {
  token: string;
  employer: string;
  domain?: string;
  careersUrl?: string;
}

/**
 * All configured sources. Greenhouse boards come from boards.json, filtered by
 * GREENHOUSE_BOARDS (comma-separated tokens) so nothing is fetched unless enabled.
 */
export function configuredSources(env: NodeJS.ProcessEnv = process.env): JobSource[] {
  const sources: JobSource[] = [];
  if (env.ENABLE_DEMO_SOURCE !== "false") sources.push(...createDemoSources());

  const enabled = new Set(
    (env.GREENHOUSE_BOARDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const b of boards as GreenhouseBoardConfig[]) {
    if (!enabled.has(b.token)) continue;
    sources.push(
      new GreenhouseSource({
        boardToken: b.token,
        employer: { name: b.employer, domain: b.domain, careersUrl: b.careersUrl },
      }),
    );
  }
  return sources;
}
