import Link from "next/link";
import { SIGNALS, STATUS_LABELS, STATUS_RULES, THRESHOLDS } from "@/verification";

export const metadata = { title: "How verification works — Provenant" };

/**
 * Renders straight from the rule table and signal catalog the code actually
 * uses (src/verification/catalog.ts) — this page can't drift from the rules.
 */
export default function HowVerificationWorksPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-accent underline">
        ← Provenant
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">How verification works</h1>
      <p className="mt-3 text-muted">
        Every job on Provenant gets a status from a fixed set of rules, applied to evidence we can show you. There is no
        single hidden score — every signal below links to what we checked, when, and what it means. Staff can override a
        status by hand; when they do, the Passport says so and names who and when.
      </p>

      <h2 className="mt-8 text-lg font-semibold">What we check</h2>
      <ul className="mt-3 space-y-4 text-sm">
        {Object.values(SIGNALS).map((s) => (
          <li key={s.code} className="rounded border border-line p-3">
            <div className="font-medium">
              {s.label} <span className="text-xs text-muted">({s.polarity === "POSITIVE_OR_NEUTRAL" ? "positive or neutral" : s.polarity.toLowerCase()})</span>
            </div>
            <p className="mt-1 text-muted">{s.checked}</p>
            <p className="mt-1">{s.meaning}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">How a status is decided</h2>
      <p className="mt-2 text-muted">We go through these rules in order and use the first one that fits.</p>
      <ol className="mt-3 space-y-2 text-sm">
        {STATUS_RULES.map((r) => (
          <li key={r.id} className="rounded border border-line p-3">
            <strong>{r.status === "OVERRIDE" ? "Staff-reviewed" : STATUS_LABELS[r.status]}</strong> — {r.when}
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-lg font-semibold">What we can't tell you</h2>
      <p className="mt-2 text-sm text-muted">
        We can confirm a posting is <em>listed</em> — we can't confirm the employer is actively hiring for it. A job can be
        genuinely open even if we can't verify it: not every real employer publishes on a job board we check yet. A posting
        is treated as stale after {THRESHOLDS.staleDays} days without confirmation, and we flag it as possibly closed after{" "}
        {THRESHOLDS.mayBeClosedDays} days.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Payment never affects verification</h2>
      <p className="mt-2 text-sm text-muted">
        No employer, recruiter or job seeker can pay to change a job's status, its signals, or where it ranks in search.
        This is enforced in the code, not just policy — the part of our system that decides status can't read billing or
        plan data at all.
      </p>
    </main>
  );
}
