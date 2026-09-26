import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "../src/db/client";

await migrate(getDb(), { migrationsFolder: "drizzle" });
console.log("migrations applied");
await closeDb();
