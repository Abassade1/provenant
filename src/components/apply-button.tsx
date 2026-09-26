"use client";

import { recordApplyClick } from "@/app/actions/reports";

export function ApplyButton({ jobId, applyUrl, caution }: { jobId: string; applyUrl: string; caution: boolean }) {
  return (
    <div>
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void recordApplyClick(jobId);
        }}
        className="inline-block rounded bg-[var(--accent)] px-5 py-2 font-medium text-[var(--bg)]"
      >
        Apply at original source
      </a>
      {caution && (
        <p className="mt-1 max-w-xs text-xs text-[var(--warn-fg)]">
          This apply link didn't match the employer's known domains — double check it before applying.
        </p>
      )}
    </div>
  );
}
