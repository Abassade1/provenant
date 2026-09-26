import { notFound } from "next/navigation";

/**
 * TEMPORARY (Phase 2): auth lands in Phase 4. Until then admin pages exist only
 * when ADMIN_DEV_OPEN=true and never in production builds.
 */
export function requireAdminDev() {
  if (process.env.NODE_ENV === "production" || process.env.ADMIN_DEV_OPEN !== "true") notFound();
}
