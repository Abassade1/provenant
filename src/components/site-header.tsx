import Link from "next/link";
import { getSession } from "@/auth/session";

export async function SiteHeader() {
  const session = await getSession();
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
