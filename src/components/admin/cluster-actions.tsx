"use client";

import { useState, useTransition } from "react";
import { keepClusterSeparate, mergeCluster } from "@/app/actions/admin";

export function ClusterActions({ clusterId, jobs }: { clusterId: string; jobs: { id: string; title: string; source: string }[] }) {
  const [keepId, setKeepId] = useState(jobs[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p className="text-sm text-muted">{done}</p>;
  if (jobs.length < 2) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={`keep-${clusterId}`} className="text-muted">
        Keep:
      </label>
      <select id={`keep-${clusterId}`} value={keepId} onChange={(e) => setKeepId(e.target.value)} className="rounded border border-line bg-transparent px-2 py-1">
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title} ({j.source})
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const dropId = jobs.find((j) => j.id !== keepId)?.id;
            if (!dropId) return;
            const r = await mergeCluster(clusterId, keepId, dropId);
            setDone("error" in r ? r.error : "Merged.");
          })
        }
        className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--bg)] disabled:opacity-50"
      >
        Merge into this one
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await keepClusterSeparate(clusterId);
            setDone("error" in r ? r.error : "Kept separate.");
          })
        }
        className="rounded border border-line px-3 py-1 disabled:opacity-50"
      >
        Keep separate
      </button>
    </div>
  );
}
