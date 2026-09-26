"use client";

import { useState, useTransition } from "react";
import { submitCheck } from "@/app/actions/check";
import { Passport } from "@/components/passport";
import type { CheckOutcome } from "@/checker/run-check";

type Mode = "url" | "text";

export default function CheckAJobPage() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [employerHint, setEmployerHint] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Check a job</h1>
      <p className="mt-1 text-muted">
        Paste a job link, or the text of a posting, email or message. We&apos;ll try to find it on the employer&apos;s
        own hiring page and show you the evidence.
      </p>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setOutcome(null);
          startTransition(async () => {
            const res = await submitCheck({ url: mode === "url" ? url : undefined, text: mode === "text" ? text : undefined, employerHint });
            if (!res.ok) setError(res.error);
            else if (!res.result.ok) setError(res.result.blockedReason);
            else setOutcome(res.result);
          });
        }}
      >
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} /> Job URL
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "text"} onChange={() => setMode("text")} /> Paste text
          </label>
        </div>

        {mode === "url" ? (
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mt-2 w-full rounded border border-line bg-transparent px-3 py-2"
          />
        ) : (
          <textarea
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the posting, recruiter email, or message text here…"
            rows={8}
            maxLength={20000}
            className="mt-2 w-full rounded border border-line bg-transparent px-3 py-2"
          />
        )}

        <div className="mt-3">
          <label htmlFor="employerHint" className="text-sm text-muted">
            Employer name (optional — helps us find the right match)
          </label>
          <input id="employerHint" value={employerHint} onChange={(e) => setEmployerHint(e.target.value)} className="mt-1 w-full rounded border border-line bg-transparent px-3 py-2" />
        </div>

        <button type="submit" disabled={pending} className="mt-4 rounded bg-[var(--accent)] px-5 py-2 font-medium text-[var(--bg)] disabled:opacity-50">
          {pending ? "Checking…" : "Check this job"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded border border-[var(--warn-fg)] p-3 text-sm text-[var(--warn-fg)]">
          {error}
        </p>
      )}

      {outcome?.verification && (
        <div className="mt-8">
          {outcome.fetchNote && <p className="mb-3 text-sm text-muted">{outcome.fetchNote}</p>}
          <Passport
            isDemo={false}
            title={outcome.extracted.title ?? "This posting"}
            employerName={outcome.extracted.employerName ?? "Unknown employer"}
            status={outcome.verification.status}
            identityStatus={outcome.employerIdentityStatus}
            employerDomain={outcome.employerDomain}
            salaries={
              outcome.extracted.salary
                ? [{ id: "check", min: outcome.extracted.salary.min ?? null, max: outcome.extracted.salary.max ?? null, period: outcome.extracted.salary.period ?? null, derived: false }]
                : []
            }
            vacancyStatement={outcome.extracted.vacancyStatement}
            vacancyStatementDerived={false}
            postedAt={null}
            lastVerifiedAt={outcome.verification.signals.find((s) => s.code === "RECENTLY_CONFIRMED_LIVE")?.observedAt ?? null}
            sources={[]}
            signals={outcome.verification.signals}
            overrideNote={null}
            overrideAt={null}
            expanded
          />

          <div className="mt-4 rounded border border-line p-4 text-sm">
            {outcome.matchedApplyUrl ? (
              <p>
                We found this on the employer&apos;s own site.{" "}
                <a href={outcome.matchedApplyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
                  Apply through the employer&apos;s site here
                </a>
                .
              </p>
            ) : (
              <p>
                We couldn&apos;t find this on the employer&apos;s site. Contact them directly using the details on
                their official website rather than any link or number in what you were sent.
              </p>
            )}
            {outcome.matchedCanonicalJobId && (
              <p className="mt-2">
                <a href={`/jobs/${outcome.matchedCanonicalJobId}`} className="text-accent underline">
                  View this job in our index
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
