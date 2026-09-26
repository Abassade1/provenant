import type { ReactNode } from "react";
import { Dotwork } from "./dotwork";

/** Full-width band: bold one-line statement + a single CTA, over the dotwork graphic. */
export function CtaBand({ title, cta }: { title: string; cta: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-[var(--primary)] text-[var(--primary-contrast)]">
      <Dotwork tone="accent" className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />
      <div className="relative mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-6 px-4 py-16 text-center md:flex-row md:justify-between md:text-left">
        <h2 className="font-display text-[length:var(--text-h2)] font-semibold">{title}</h2>
        {cta}
      </div>
    </section>
  );
}
