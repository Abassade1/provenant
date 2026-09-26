import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { notification, savedSearch } from "@/db/schema";
import { searchJobs } from "./search";
import { searchFiltersSchema, type SearchFilters } from "@/lib/search-params";

/**
 * Saved-search alerts (brief §2 success step 6, §14 P0 item 14 — "Notification
 * interface ready for email/push"). For each saved search, finds canonical
 * jobs matching its filters that first appeared since the search was last
 * checked, writes one in-app notification per new match, and advances
 * `lastNotifiedAt`. Email/push are P1; this is the in-app notifier the brief
 * asks the interface to be ready for.
 */
export async function generateSavedSearchAlerts(db: DB, now: Date = new Date()): Promise<{ searches: number; notifications: number }> {
  const searches = await db.select().from(savedSearch);
  let notifications = 0;

  for (const s of searches) {
    const parsed = searchFiltersSchema.safeParse(s.filters as SearchFilters);
    if (!parsed.success) continue; // filters shape changed since saved — skip rather than crash the batch
    const since = s.lastNotifiedAt ?? s.createdAt;

    const result = await searchJobs(db, parsed.data, { sinceFirstSeenAt: since, unpaged: true });
    if (result.rows.length > 0) {
      await db.insert(notification).values(
        result.rows.map((r) => ({
          userId: s.userId,
          kind: "saved_search_match",
          title: `New match for “${s.name}”`,
          body: `${r.title} at ${r.employerName}${r.city ? ` · ${r.city}` : ""}`,
          link: `/jobs/${r.id}`,
        })),
      );
      notifications += result.rows.length;
    }
    await db.update(savedSearch).set({ lastNotifiedAt: now }).where(eq(savedSearch.id, s.id));
  }

  return { searches: searches.length, notifications };
}
