import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import { user } from "../src/db/schema";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}

const db = getDb();
const [row] = await db.update(user).set({ role: "ADMIN" }).where(eq(user.email, email)).returning({ id: user.id, email: user.email });
if (!row) {
  console.error(`No user with email ${email}. Sign up first, then run this again.`);
  process.exit(1);
}
console.log(`${row.email} is now ADMIN.`);
await closeDb();
