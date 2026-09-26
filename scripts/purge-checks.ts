import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { purgeExpiredChecks } from "../src/checker/purge";

const deleted = await purgeExpiredChecks(getDb());
console.log(`purged ${deleted} expired job check(s)`);
await closeDb();
