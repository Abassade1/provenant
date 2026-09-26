import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobSourceRecord } from "@/db/schema";

export interface DedupeDecision {
  /** Existing canonical job this posting belongs to, or null to create one. */
  canonicalJobId: string | null;
  reason: "SAME_SOURCE_RECORD" | "NEW";
}

/**
 * PHASE 2 (placeholder): a posting is the same job only if the same source
 * already gave us the same external ref. Phase 3 replaces this with blocking +
 * similarity scoring across sources.
 */
export async function deduplicate(db: DB, sourceId: string, externalRef: string): Promise<DedupeDecision> {
  const [hit] = await db
    .select({ canonicalJobId: jobSourceRecord.canonicalJobId })
    .from(jobSourceRecord)
    .where(and(eq(jobSourceRecord.sourceId, sourceId), eq(jobSourceRecord.externalRef, externalRef)))
    .limit(1);
  return hit ? { canonicalJobId: hit.canonicalJobId, reason: "SAME_SOURCE_RECORD" } : { canonicalJobId: null, reason: "NEW" };
}
