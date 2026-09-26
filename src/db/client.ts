import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __pool?: Pool; __db?: DB };

export function getPool(): Pool {
  if (!globalForDb.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__pool = new Pool({ connectionString: url, max: 10 });
  }
  return globalForDb.__pool;
}

export function getDb(): DB {
  globalForDb.__db ??= drizzle(getPool(), { schema });
  return globalForDb.__db;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__pool?.end();
  globalForDb.__pool = undefined;
  globalForDb.__db = undefined;
}

export { schema };
