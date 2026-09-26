import { getDb } from "@/db/client";
import { analyticsEvent } from "@/db/schema";

export type AnalyticsEventName =
  | "check_submitted"
  | "passport_expanded"
  | "search_performed"
  | "apply_clicked"
  | "job_saved"
  | "alert_created"
  | "report_submitted";

/** Fire-and-forget event insert. Never blocks or fails the caller's action. */
export function track(name: AnalyticsEventName, data: { userId?: string; sessionId?: string; properties?: Record<string, unknown> } = {}) {
  getDb()
    .insert(analyticsEvent)
    .values({ name, userId: data.userId, sessionId: data.sessionId, properties: data.properties ?? {} })
    .catch(() => {});
}
