import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Before you apply, know what you&apos;re applying to.</h1>
        <p className="mt-4 text-lg text-muted">
          Paste any job link and see where it really came from, whether it&apos;s still open, and what the salary
          evidence says.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/check" className="rounded bg-[var(--accent)] px-6 py-3 font-medium text-[var(--bg)]">
            Check a job
          </Link>
          <Link href="/search" className="rounded border border-line px-6 py-3 font-medium">
            Search verified jobs
          </Link>
        </div>
        <p className="mt-4 text-sm">
          <Link href="/docs/verification" className="text-accent underline">
            How verification works
          </Link>
        </p>
      </section>

      <section className="border-t border-line bg-[var(--line)]/10 py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-semibold">The problem</h2>
          <p className="mt-3 text-muted">
            Job postings go stale, get reposted across a dozen sites, and sometimes were never real to begin with. A
            growing share of scams never touch a job board at all — they arrive by text message, WhatsApp, and social
            media, where a search index alone can never reach them.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-semibold">The Job Passport</h2>
          <p className="mt-3 text-muted">
            Every job gets one Job Passport — the same evidence, whether you found it through Search or pasted a link
            from somewhere else. Every row expands to what we checked, when, and what it means. There is no single
            hidden score.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-[var(--line)]/10 py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-semibold">How verification works</h2>
          <p className="mt-3 text-muted">
            Rule-based, deterministic, and fully explainable — read the{" "}
            <Link href="/docs/verification" className="text-accent underline">
              plain-language rule table
            </Link>{" "}
            we actually run in code.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-semibold">Salary you can trust</h2>
          <p className="mt-3 text-muted">
            We label every figure in words — &ldquo;employer advertised&rdquo; versus an estimate — and we never fill a
            gap with a guess. No salary disclosed means we say so.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-[var(--line)]/10 py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-semibold">Our privacy promise</h2>
          <p className="mt-3 text-muted">
            A pasted message may mention other people — we never log its raw text, and checks are kept private and
            deleted after a limited retention period. Export or delete your data at any time from your account.
          </p>
        </div>
      </section>
    </main>
  );
}
