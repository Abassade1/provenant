import { lt } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobCheck } from "@/db/schema";

/**
 * Deletes job_check rows past their retention period (brief §16 — a check is
 * private and deleted after a limited retention period; CHECK_RETENTION_DAYS
 * sets `expiresAt` at creation in src/app/actions/check.ts). Cascades to
 * job_report.jobCheckId via ON DELETE CASCADE. Returns the number deleted.
 */
export async function purgeExpiredChecks(db: DB, now: Date = new Date()): Promise<number> {
  const deleted = await db.delete(jobCheck).where(lt(jobCheck.expiresAt, now)).returning({ id: jobCheck.id });
  return deleted.length;
}
