import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { recheckAndReverify } from "../src/pipeline/worker";

console.log(await recheckAndReverify(getDb()));
await closeDb();
