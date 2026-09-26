import type { ReactNode } from "react";

/**
 * Slow horizontal marquee — used for the source-type strip and the problem
 * pill rows (brief patterns 4 & 5). Pauses on hover; the global
 * `prefers-reduced-motion: reduce` rule (globals.css) already zeroes the
 * animation duration, so no separate JS check is needed here.
 */
export function Marquee({ items, direction = "forward", variant = "pill" }: { items: ReactNode[]; direction?: "forward" | "reverse"; variant?: "pill" | "text" }) {
  const doubled = [...items, ...items];
  const itemCls =
    variant === "pill"
      ? "rounded-[var(--radius-full)] border border-line bg-[var(--surface)] px-4 py-2 text-sm text-fg whitespace-nowrap"
      : "text-sm font-medium uppercase tracking-wide text-muted whitespace-nowrap";
  return (
    <div className="marquee-row overflow-hidden" role="list" aria-label="Scrolling examples">
      <div className="marquee-track flex w-max gap-4" data-direction={direction === "reverse" ? "reverse" : undefined}>
        {doubled.map((item, i) => (
          <div key={i} className={itemCls} role="listitem" aria-hidden={i >= items.length}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
