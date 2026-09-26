import type { ReactNode } from "react";
import { Dotwork } from "./dotwork";

/** Split hero: headline + explainer + two CTAs left, a product visual right. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  visual,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  visual: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[var(--bg)]">
      <Dotwork tone="accent" className="pointer-events-none absolute inset-x-0 top-0 h-full w-full opacity-60" />
      <div className="relative mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-10 px-4 py-[var(--section-py)] md:grid-cols-2 md:px-8">
        <div className="flex flex-col items-start gap-5">
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</div>}
          <h1 className="font-display text-[length:var(--text-display)] font-semibold leading-[1.1] text-fg">{title}</h1>
          <p className="max-w-[46ch] text-[length:var(--text-body-lg)] text-muted">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
        <div className="relative">{visual}</div>
      </div>
    </section>
  );
}
