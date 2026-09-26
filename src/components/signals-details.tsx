"use client";

import { useRef } from "react";
import { recordPassportExpanded } from "@/app/actions/analytics";

/** Wraps the Passport's signal list so opening it (once) fires passport_expanded. */
export function SignalsDetails({ context, summary, expanded, children }: { context: string; summary: React.ReactNode; expanded: boolean; children: React.ReactNode }) {
  const tracked = useRef(false);
  return (
    <details
      className="mt-5"
      open={expanded}
      onToggle={(e) => {
        if (!tracked.current && (e.target as HTMLDetailsElement).open) {
          tracked.current = true;
          void recordPassportExpanded(context);
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-medium">{summary}</summary>
      {children}
    </details>
  );
}
