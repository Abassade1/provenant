import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { log } from "../src/lib/log";
import { ingestAll } from "../src/pipeline/ingest-all";
import { configuredSources } from "../src/sources/registry";

const only = process.argv[2]; // optional source key filter, e.g. "demo:" or "greenhouse:acme"
const sources = configuredSources().filter((s) => !only || s.descriptor.key.startsWith(only));
if (sources.length === 0) {
  log("no sources matched", { only });
} else {
  const results = await ingestAll(getDb(), sources, { log });
  console.table(results.map(({ source, status, fetched, upserted, skipped, errored }) => ({ source, status, fetched, upserted, skipped, errored })));
}
await closeDb();
