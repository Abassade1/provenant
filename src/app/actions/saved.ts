"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { savedJob, savedSearch } from "@/db/schema";
import { track } from "@/lib/analytics";
import { searchFiltersSchema } from "@/lib/search-params";

export async function toggleSaveJob(jobId: string): Promise<{ saved: boolean } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: "Sign in to save jobs." };
  const db = getDb();
  const existing = await db
    .select({ id: savedJob.id })
    .from(savedJob)
    .where(and(eq(savedJob.userId, session.user.id), eq(savedJob.canonicalJobId, jobId)));
  if (existing.length) {
    await db.delete(savedJob).where(eq(savedJob.id, existing[0]!.id));
    revalidatePath("/saved");
    return { saved: false };
  }
  await db.insert(savedJob).values({ userId: session.user.id, canonicalJobId: jobId });
  track("job_saved", { userId: session.user.id, properties: { jobId } });
  revalidatePath("/saved");
  return { saved: true };
}

export async function createSavedSearch(name: string, filters: unknown): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: "Sign in to save a search." };
  const parsed = searchFiltersSchema.safeParse(filters);
  if (!parsed.success) return { error: "Invalid search filters." };
  const trimmed = name.trim().slice(0, 120) || "Saved search";
  await getDb().insert(savedSearch).values({ userId: session.user.id, name: trimmed, filters: parsed.data });
  track("alert_created", { userId: session.user.id, properties: { name: trimmed } });
  revalidatePath("/saved");
  return { ok: true };
}

export async function deleteSavedSearch(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: "Sign in required." };
  await getDb().delete(savedSearch).where(and(eq(savedSearch.id, id), eq(savedSearch.userId, session.user.id)));
  revalidatePath("/saved");
  return { ok: true };
}
