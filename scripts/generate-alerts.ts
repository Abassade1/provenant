import "dotenv/config";
import { closeDb, getDb } from "../src/db/client";
import { generateSavedSearchAlerts } from "../src/evidence/alerts";

console.log(await generateSavedSearchAlerts(getDb()));
await closeDb();
