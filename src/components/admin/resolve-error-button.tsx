"use client";

import { useState, useTransition } from "react";
import { resolveIngestionError } from "@/app/actions/admin";

export function ResolveErrorButton({ errorId }: { errorId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="text-xs text-muted">Resolved.</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await resolveIngestionError(errorId); setDone(true); })}
      className="rounded border border-line px-2 py-1 text-xs disabled:opacity-50"
    >
      Mark resolved
    </button>
  );
}
