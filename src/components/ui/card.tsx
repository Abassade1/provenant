import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-md)] border border-line bg-[var(--surface)] p-5 shadow-[var(--shadow-1)] ${className}`}>
      {children}
    </div>
  );
}

/** Icon + short title + one-line description — the "how we solve it" grid. */
export function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-surface-raised text-accent">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="font-display text-base font-semibold text-fg">{title}</div>
      <p className="text-sm text-muted">{description}</p>
    </Card>
  );
}

/**
 * Trust & security claim — only ever pass claims the product can actually
 * back (brief: "no fake stats, client logos, testimonials, or badges").
 */
export function TrustBadgeCard({ icon: Icon, title, lines }: { icon: LucideIcon; title: string; lines: [string, string] }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex size-10 items-center justify-center rounded-[var(--radius-full)] bg-[var(--primary)] text-[var(--primary-contrast)]">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="font-display text-base font-semibold text-fg">{title}</div>
      <ul className="space-y-1 text-sm text-muted">
        <li>{lines[0]}</li>
        <li>{lines[1]}</li>
      </ul>
    </Card>
  );
}
