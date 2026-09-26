import { eq, isNull, and, sql } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { notification } from "@/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";

const PRODUCT_LINKS = [
  { href: "/check", label: "Check a job" },
  { href: "/search", label: "Search" },
];

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
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--surface)]/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-[var(--content-max-width)] items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="font-display text-lg font-semibold text-fg">
          Provenant
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {PRODUCT_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-fg hover:bg-surface-raised">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {session?.user ? (
            <>
              <Link href="/saved" className="text-sm text-muted hover:text-fg">
                Saved
              </Link>
              <Link href="/notifications" className="text-sm text-muted hover:text-fg">
                Notifications
                {unread > 0 && <span className="ml-1 rounded-[var(--radius-full)] bg-accent px-1.5 py-0.5 text-xs text-accent-contrast">{unread}</span>}
              </Link>
              <Link href="/account" className="text-sm text-muted hover:text-fg">
                {session.user.name || session.user.email}
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm text-muted hover:text-fg">
                Log in
              </Link>
              <ButtonLink href="/sign-up" size="sm">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>

        <MobileNav>
          <nav className="flex flex-col gap-1" aria-label="Primary">
            {PRODUCT_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-[var(--radius-sm)] px-2 py-2 text-sm font-medium text-fg">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {session?.user ? (
              <>
                <Link href="/saved" className="text-sm text-muted">
                  Saved
                </Link>
                <Link href="/notifications" className="text-sm text-muted">
                  Notifications{unread > 0 && <span className="ml-1 rounded-[var(--radius-full)] bg-accent px-1.5 py-0.5 text-xs text-accent-contrast">{unread}</span>}
                </Link>
                <Link href="/account" className="text-sm text-muted">
                  {session.user.name || session.user.email}
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-muted">
                  Log in
                </Link>
                <ButtonLink href="/sign-up" size="sm">
                  Sign up
                </ButtonLink>
              </>
            )}
          </div>
        </MobileNav>
      </div>
    </header>
  );
}
