"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "@/app/actions/admin";

export function ReportActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p className="text-xs text-muted">{done}</p>;
  return (
    <div className="mt-2 flex gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { const r = await resolveReport(reportId, "UPHELD"); setDone("error" in r ? r.error : "Upheld."); })}
        className="rounded border border-line px-2 py-1"
      >
        Uphold
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { const r = await resolveReport(reportId, "DISMISSED"); setDone("error" in r ? r.error : "Dismissed."); })}
        className="rounded border border-line px-2 py-1"
      >
        Dismiss
      </button>
    </div>
  );
}
