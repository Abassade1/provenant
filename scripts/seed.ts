import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { log } from "../src/lib/log";
import { ingestAll } from "../src/pipeline/ingest-all";
import { createDemoSources } from "../src/sources/demo";

// Seeds the database by running the demo connector through the real pipeline.
const results = await ingestAll(getDb(), createDemoSources(), { log });
const total = results.reduce((n, r) => n + r.upserted, 0);
console.log(`seeded ${total} demo jobs from ${results.length} demo sources`);
await closeDb();
