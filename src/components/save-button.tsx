"use client";

import { useState, useTransition } from "react";
import { toggleSaveJob } from "@/app/actions/saved";

export function SaveButton({ jobId, initialSaved, signedIn }: { jobId: string; initialSaved: boolean; signedIn: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a href="/sign-in" className="text-sm text-accent underline">
        Sign in to save
      </a>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-pressed={saved}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleSaveJob(jobId);
            if ("error" in result) setNotice(result.error);
            else setSaved(result.saved);
          })
        }
        className="rounded border border-line px-3 py-1 text-sm hover:bg-[var(--line)]/30 disabled:opacity-50"
      >
        {saved ? "★ Saved" : "☆ Save"}
      </button>
      {notice && (
        <p role="status" className="mt-1 text-xs text-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
