"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb } from "@/db/client";
import { adminAuditLog, canonicalJob, duplicateCluster, ingestionError, jobReport, jobSourceRecord } from "@/db/schema";
import { knownDomains, verifyJob } from "@/evidence/verify-job";
import { rollupFreshness } from "@/evidence/freshness";
import type { JobStatus } from "@/verification";

/** revalidatePath needs a request-scoped store that doesn't exist outside a
 * real Next.js request (e.g. when an action is called directly in tests) —
 * never let that break the mutation it's just a cache hint for. */
function revalidatePath(path: string) {
  try {
    nextRevalidatePath(path);
  } catch {
    // no request-scoped store (e.g. a direct call outside Next's runtime) — safe to ignore
  }
}

const OVERRIDE_STATUSES: JobStatus[] = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "STALE", "EXPIRED", "REVIEW_REQUIRED", "HIGH_RISK"];

async function audit(actorUserId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
  await getDb().insert(adminAuditLog).values({ actorUserId: actorUserId === "dev" ? null : actorUserId, action, entity, entityId, before, after });
}

/** R0: staff sets a job's status by hand. Always audited and always shown in the Passport. */
export async function overrideJobStatus(jobId: string, status: JobStatus | "CLEAR", note: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  if (status !== "CLEAR" && !OVERRIDE_STATUSES.includes(status)) return { error: "Invalid status." };
  const db = getDb();
  const [before] = await db.select({ overrideStatus: canonicalJob.overrideStatus, overrideNote: canonicalJob.overrideNote }).from(canonicalJob).where(eq(canonicalJob.id, jobId));
  if (!before) return { error: "Job not found." };

  const now = new Date();
  await db
    .update(canonicalJob)
    .set(
      status === "CLEAR"
        ? { overrideStatus: null, overrideNote: null, overrideBy: null, overrideAt: null }
        : { overrideStatus: status, overrideNote: note.trim().slice(0, 500) || null, overrideBy: admin.id === "dev" ? null : admin.id, overrideAt: now },
    )
    .where(eq(canonicalJob.id, jobId));

  await audit(admin.id, status === "CLEAR" ? "CLEAR_OVERRIDE" : "SET_OVERRIDE", "canonical_job", jobId, before, { status, note });
  const domains = await knownDomains(db);
  await verifyJob(db, jobId, now, domains);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/** Resolve a REVIEW_REQUIRED duplicate cluster by merging the loser's records into the winner. */
export async function mergeCluster(clusterId: string, keepJobId: string, dropJobId: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const [cluster] = await db.select().from(duplicateCluster).where(eq(duplicateCluster.id, clusterId));
  if (!cluster || cluster.status !== "REVIEW_REQUIRED") return { error: "This cluster isn't awaiting review." };

  await db.transaction(async (tx) => {
    await tx.update(jobSourceRecord).set({ canonicalJobId: keepJobId }).where(eq(jobSourceRecord.canonicalJobId, dropJobId));
    await tx.update(duplicateCluster).set({ status: "RESOLVED" }).where(eq(duplicateCluster.id, clusterId));
    await tx.update(canonicalJob).set({ expiredAt: new Date() }).where(eq(canonicalJob.id, dropJobId));
  });

  await audit(admin.id, "MERGE_DUPLICATE", "duplicate_cluster", clusterId, { keepJobId, dropJobId }, null);
  const now = new Date();
  await rollupFreshness(db, [keepJobId]);
  const domains = await knownDomains(db);
  await verifyJob(db, keepJobId, now, domains);
  await verifyJob(db, dropJobId, now, domains);
  revalidatePath("/admin/review");
  return { ok: true };
}

/** Resolve a cluster by declaring the two jobs genuinely separate postings. */
export async function keepClusterSeparate(clusterId: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const [cluster] = await db.select().from(duplicateCluster).where(eq(duplicateCluster.id, clusterId));
  if (!cluster || cluster.status !== "REVIEW_REQUIRED") return { error: "This cluster isn't awaiting review." };

  const recs = await db.select({ canonicalJobId: jobSourceRecord.canonicalJobId }).from(jobSourceRecord).where(eq(jobSourceRecord.duplicateClusterId, clusterId));
  await db.update(duplicateCluster).set({ status: "RESOLVED" }).where(eq(duplicateCluster.id, clusterId));
  await db.update(jobSourceRecord).set({ duplicateClusterId: null }).where(eq(jobSourceRecord.duplicateClusterId, clusterId));

  await audit(admin.id, "KEEP_SEPARATE", "duplicate_cluster", clusterId, null, null);
  const now = new Date();
  const domains = await knownDomains(db);
  for (const id of new Set(recs.map((r) => r.canonicalJobId))) await verifyJob(db, id, now, domains);
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function resolveReport(reportId: string, decision: "UPHELD" | "DISMISSED"): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  const [report] = await db.select().from(jobReport).where(eq(jobReport.id, reportId));
  if (!report || report.status !== "PENDING") return { error: "This report isn't pending." };

  await db.update(jobReport).set({ status: decision }).where(eq(jobReport.id, reportId));
  await audit(admin.id, `REPORT_${decision}`, "job_report", reportId, { status: "PENDING" }, { status: decision });
  if (report.canonicalJobId) {
    const domains = await knownDomains(db);
    await verifyJob(db, report.canonicalJobId, new Date(), domains);
    revalidatePath(`/admin/jobs/${report.canonicalJobId}`);
  }
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function resolveIngestionError(errorId: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  const db = getDb();
  await db.update(ingestionError).set({ resolvedAt: new Date() }).where(and(eq(ingestionError.id, errorId)));
  await audit(admin.id, "RESOLVE_INGESTION_ERROR", "ingestion_error", errorId, null, null);
  revalidatePath("/admin/sources");
  return { ok: true };
}
