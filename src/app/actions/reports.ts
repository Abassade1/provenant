"use server";

import { z } from "zod";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { jobReport } from "@/db/schema";
import { track } from "@/lib/analytics";

const reportSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.enum(["SCAM_SIGNS", "ALREADY_FILLED", "WRONG_INFO", "OTHER"]),
  details: z.string().trim().max(2000).optional(),
});

export async function submitReport(input: z.infer<typeof reportSchema>): Promise<{ ok: true } | { error: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "Please choose a reason." };
  const session = await getSession();
  await getDb()
    .insert(jobReport)
    .values({ userId: session?.user?.id, canonicalJobId: parsed.data.jobId, reason: parsed.data.reason, details: parsed.data.details });
  track("report_submitted", { userId: session?.user?.id, properties: { jobId: parsed.data.jobId, reason: parsed.data.reason } });
  return { ok: true };
}

export async function recordApplyClick(jobId: string): Promise<void> {
  const session = await getSession();
  track("apply_clicked", { userId: session?.user?.id, properties: { jobId } });
}
