import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { canonicalJob, jobSourceRecord } from "@/db/schema";
import type { NormalizedPosting } from "./normalize";

export interface UpsertInput {
  sourceId: string;
  rawPostingId: string;
  employerId: string;
  canonicalJobId: string | null;
  posting: NormalizedPosting;
  isDemo: boolean;
  now: Date;
}

/** Create or refresh the canonical job and its source record. Returns the canonical job id. */
export async function upsertJob(db: DB, input: UpsertInput): Promise<string> {
  const { posting: p, now, isDemo } = input;
  return db.transaction(async (tx) => {
    const fields = {
      title: p.title,
      titleNormalized: p.titleNormalized,
      titleStem: p.titleStem,
      city: p.city,
      province: p.province,
      remoteType: p.remoteType,
      employmentType: p.employmentType,
      description: p.description,
      applyUrl: p.applyUrl,
      postedAt: p.postedAt,
    };
    let jobId = input.canonicalJobId;
    if (jobId) {
      await tx.update(canonicalJob).set({ ...fields, lastSeenAt: now }).where(eq(canonicalJob.id, jobId));
    } else {
      const [row] = await tx
        .insert(canonicalJob)
        .values({ ...fields, employerId: input.employerId, firstSeenAt: now, lastSeenAt: now, isDemo })
        .returning({ id: canonicalJob.id });
      jobId = row!.id;
    }

    await tx
      .insert(jobSourceRecord)
      .values({
        canonicalJobId: jobId,
        sourceId: input.sourceId,
        rawPostingId: input.rawPostingId,
        externalRef: p.externalRef,
        url: p.url,
        applyUrl: p.applyUrl,
        title: p.title,
        locationText: p.locationText,
        postedAt: p.postedAt,
        firstSeenAt: now,
        lastSeenAt: now,
        isDemo,
      })
      .onConflictDoUpdate({
        target: [jobSourceRecord.sourceId, jobSourceRecord.externalRef],
        set: {
          rawPostingId: input.rawPostingId,
          url: p.url,
          applyUrl: p.applyUrl,
          title: p.title,
          locationText: p.locationText,
          postedAt: p.postedAt,
          lastSeenAt: now,
          expiredAt: null,
        },
      });
    return jobId;
  });
}
