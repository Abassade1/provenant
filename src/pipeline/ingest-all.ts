import type { DB } from "@/db/client";
import { configuredSources } from "@/sources/registry";
import type { JobSource } from "@/sources/types";
import { runSource, type RunOptions, type RunResult } from "./run";

export async function ingestAll(
  db: DB,
  sources: JobSource[] = configuredSources(),
  opts: RunOptions = {},
): Promise<(RunResult & { source: string })[]> {
  const results = [];
  for (const s of sources) {
    results.push({ source: s.descriptor.key, ...(await runSource(db, s, opts)) });
  }
  return results;
}
