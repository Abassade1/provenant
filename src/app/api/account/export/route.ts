import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { canonicalJob, jobCheck, notification, savedJob, savedSearch, user, userProfile } from "@/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = getDb();
  const uid = session.user.id;

  const [profile, saved, searches, notifications, checks, account] = await Promise.all([
    db.select().from(userProfile).where(eq(userProfile.userId, uid)),
    db
      .select({ jobId: savedJob.canonicalJobId, title: canonicalJob.title, savedAt: savedJob.createdAt })
      .from(savedJob)
      .innerJoin(canonicalJob, eq(canonicalJob.id, savedJob.canonicalJobId))
      .where(eq(savedJob.userId, uid)),
    db.select().from(savedSearch).where(eq(savedSearch.userId, uid)),
    db.select().from(notification).where(eq(notification.userId, uid)),
    // Pasted text is never included in an export — only metadata about the check itself.
    db
      .select({ id: jobCheck.id, inputUrl: jobCheck.inputUrl, status: jobCheck.status, matchedCanonicalJobId: jobCheck.matchedCanonicalJobId, createdAt: jobCheck.createdAt })
      .from(jobCheck)
      .where(eq(jobCheck.userId, uid)),
    db.select().from(user).where(eq(user.id, uid)),
  ]);

  const body = JSON.stringify(
    { account: account[0], profile: profile[0] ?? null, savedJobs: saved, savedSearches: searches, notifications, checks },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="provenant-data.json"' },
  });
}
