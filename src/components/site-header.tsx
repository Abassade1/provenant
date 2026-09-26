import { eq, isNull, and, sql } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { notification } from "@/db/schema";

export async function SiteHeader() {
  const session = await getSession();
  const unread = session?.user
    ? (
        await getDb()
          .select({ n: sql<number>`count(*)::int` })
          .from(notification)
          .where(and(eq(notification.userId, session.user.id), isNull(notification.readAt)))
      )[0]!.n
    : 0;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Provenant
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/check" className="hover:underline">
            Check a job
          </Link>
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          {session?.user ? (
            <>
              <Link href="/saved" className="hover:underline">
                Saved
              </Link>
              <Link href="/notifications" className="hover:underline">
                Notifications{unread > 0 && <span className="ml-1 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs text-[var(--bg)]">{unread}</span>}
              </Link>
              <Link href="/account" className="hover:underline">
                {session.user.name || session.user.email}
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:underline">
                Sign in
              </Link>
              <Link href="/sign-up" className="text-accent hover:underline">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
