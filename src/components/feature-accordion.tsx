"use client";

import { useState, type ReactNode } from "react";

export interface FeatureAccordionItem {
  /** A pre-rendered icon element (e.g. <ShieldCheck className="size-4" />) — component references aren't
   * serializable across the server/client boundary, so the caller renders it, not this component. */
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureAccordion({ items }: { items: FeatureAccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.title} className={`rounded-[var(--radius-md)] border p-3 transition-colors duration-[var(--duration-fast)] ${open ? "border-accent bg-surface-raised" : "border-line"}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? -1 : i)}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className={`shrink-0 ${open ? "text-accent" : "text-muted"}`}>{item.icon}</span>
              <span className="text-sm font-medium text-fg">{item.title}</span>
            </button>
            {open && <p className="mt-2 pl-7 text-sm text-muted">{item.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
