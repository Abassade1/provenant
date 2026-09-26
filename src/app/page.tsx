import Link from "next/link";

// Placeholder until the Phase 4 landing page.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Before you apply, know what you&apos;re applying to.</h1>
      <p className="mt-4 text-muted">Provenant is in development. Check a Job and Search arrive in Phase 4.</p>
      {process.env.ADMIN_DEV_OPEN === "true" && (
        <p className="mt-8">
          <Link className="text-accent underline" href="/admin/jobs">
            Admin: canonical jobs
          </Link>
        </p>
      )}
    </main>
  );
}
