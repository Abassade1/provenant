"use server";

import { eq } from "drizzle-orm";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { user } from "@/db/schema";

/**
 * Hard-deletes the account. FKs on session/account/user_profile/saved_job/
 * saved_search/notification/job_check are ON DELETE CASCADE, so deleting the
 * user row is a real, complete hard delete (brief §16) — not a soft flag.
 * job_report keeps its row with userId set null (it documents a job, and
 * deleting it would erase evidence other users' reports rely on).
 */
export async function deleteAccount(): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: "Not signed in." };
  await getDb().delete(user).where(eq(user.id, session.user.id));
  return { ok: true };
}
