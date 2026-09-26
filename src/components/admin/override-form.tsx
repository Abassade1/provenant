"use client";

import { useState, useTransition } from "react";
import { overrideJobStatus } from "@/app/actions/admin";
import { STATUS_LABELS, type JobStatus } from "@/verification";

const STATUSES: JobStatus[] = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "STALE", "EXPIRED", "REVIEW_REQUIRED", "HIGH_RISK"];

export function OverrideForm({ jobId, current }: { jobId: string; current: { status: JobStatus | null; note: string | null } }) {
  const [status, setStatus] = useState<JobStatus>(current.status ?? "VERIFIED");
  const [note, setNote] = useState(current.note ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded border border-line p-4 text-sm">
      <h3 className="font-medium">Staff override</h3>
      <p className="mt-1 text-muted">
        {current.status ? `Currently overridden to ${STATUS_LABELS[current.status]}.` : "No override is set — the status above comes from the rules."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="override-status" className="sr-only">
          Override status
        </label>
        <select id="override-status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className="rounded border border-line bg-transparent px-2 py-1">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (shown on the Passport)" className="min-w-[16rem] flex-1 rounded border border-line bg-transparent px-2 py-1" />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await overrideJobStatus(jobId, status, note);
              setMessage("error" in r ? r.error : "Override applied.");
            })
          }
          className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--bg)] disabled:opacity-50"
        >
          Set override
        </button>
        {current.status && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await overrideJobStatus(jobId, "CLEAR", "");
                setMessage("error" in r ? r.error : "Override cleared.");
              })
            }
            className="text-muted underline"
          >
            Clear override
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="mt-2 text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
