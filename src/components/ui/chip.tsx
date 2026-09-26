import { AlertTriangle, CheckCircle2, CircleDot, Clock, HelpCircle, ShieldAlert, XCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import type { JobStatus } from "@/verification";

/** A togglable filter pill — e.g. search filter chips. */
export function FilterChip({
  active = false,
  className = "",
  children,
  ...rest
}: { active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-sm transition-colors duration-[var(--duration-fast)] ${
        active ? "border-accent bg-accent text-accent-contrast" : "border-line text-fg hover:bg-surface-raised"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const STATUS_META: Record<JobStatus, { label: string; icon: typeof CheckCircle2; tone: string; bg: string }> = {
  VERIFIED: { label: "Verified", icon: CheckCircle2, tone: "text-success", bg: "bg-success-bg" },
  PARTIALLY_VERIFIED: { label: "Partially verified", icon: CircleDot, tone: "text-fg", bg: "bg-surface-raised" },
  UNVERIFIED: { label: "Unverified", icon: HelpCircle, tone: "text-muted", bg: "bg-surface-raised" },
  STALE: { label: "Stale", icon: Clock, tone: "text-muted", bg: "bg-surface-raised" },
  EXPIRED: { label: "Expired", icon: XCircle, tone: "text-muted", bg: "bg-surface-raised" },
  REVIEW_REQUIRED: { label: "Needs review", icon: AlertTriangle, tone: "text-warn-fg", bg: "bg-warn-bg" },
  HIGH_RISK: { label: "High risk", icon: ShieldAlert, tone: "text-danger", bg: "bg-danger-bg" },
};

/**
 * Job status — icon + text always together, never colour alone (brief §11,
 * §16; carried over from the pre-redesign passport.tsx STATUS_ICON table).
 */
export function StatusChip({ status, demo = false }: { status: JobStatus; demo?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-medium ${meta.tone} ${meta.bg}`}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
      {demo && " (demo)"}
    </span>
  );
}

const SALARY_META: Record<"employer" | "extracted" | "pasted", { label: string; tone: string; bg: string; border: string }> = {
  employer: { label: "Employer advertised", tone: "text-success", bg: "bg-success-bg", border: "border-transparent" },
  extracted: { label: "Extracted automatically", tone: "text-fg", bg: "bg-surface-raised", border: "border-transparent" },
  pasted: { label: "From pasted text — not confirmed", tone: "text-warn-fg", bg: "bg-[var(--surface)]", border: "border-dashed border-line" },
};

/**
 * Salary provenance tag — visibly distinct per source, not just worded
 * differently (brief's component list calls this out explicitly).
 */
export function SalaryEvidenceTag({ kind }: { kind: "employer" | "extracted" | "pasted" }) {
  const meta = SALARY_META[kind];
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ${meta.tone} ${meta.bg} ${meta.border}`}>
      {meta.label}
    </span>
  );
}
