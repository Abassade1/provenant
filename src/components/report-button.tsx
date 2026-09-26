"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/app/actions/reports";

const REASONS = [
  { value: "SCAM_SIGNS", label: "Shows signs of a scam" },
  { value: "ALREADY_FILLED", label: "Already filled or closed" },
  { value: "WRONG_INFO", label: "Wrong information (salary, location, etc.)" },
  { value: "OTHER", label: "Something else" },
] as const;

export function ReportButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("SCAM_SIGNS");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-sm text-muted">Thanks — this feeds our review queue.</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded border border-line px-3 py-2 text-sm">
        Report this job
      </button>
    );
  }
  return (
    <form
      className="rounded border border-line p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await submitReport({ jobId, reason, details: details || undefined });
          if (!("error" in result)) setDone(true);
        });
      }}
    >
      <fieldset>
        <legend className="text-xs text-muted">Why are you reporting this job?</legend>
        {REASONS.map((r) => (
          <label key={r.value} className="mt-1 flex items-center gap-2">
            <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
            {r.label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Anything else we should know? (optional)"
        maxLength={2000}
        className="mt-2 w-full rounded border border-line bg-transparent p-2 text-sm"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--bg)] disabled:opacity-50">
          Submit report
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
