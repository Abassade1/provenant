import { notFound } from "next/navigation";
import { getSession } from "@/auth/session";

/**
 * Server-side authorization for every admin route (brief §16). Requires a
 * signed-in user with role ADMIN. ADMIN_DEV_OPEN=true also allows access
 * without signing in, but only outside a production build — a dev
 * convenience left over from Phase 2, never available once deployed.
 *
 * 404 rather than 403: an admin path shouldn't confirm its own existence to
 * a logged-out visitor.
 */
export async function requireAdmin(): Promise<{ id: string; email: string; name: string }> {
  const devBypass = process.env.NODE_ENV !== "production" && process.env.ADMIN_DEV_OPEN === "true";
  if (devBypass) return { id: "dev", email: "dev@localhost", name: "Dev" };

  const session = await getSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") notFound();
  return session.user;
}
