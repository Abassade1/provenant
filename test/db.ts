import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/** Empty every application table (keeps migrations). */
export async function resetDb() {
  const db = getDb();
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}
