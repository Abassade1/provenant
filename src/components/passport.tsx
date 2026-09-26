import { CheckCircle2 } from "lucide-react";
import { StatusChip, SalaryEvidenceTag } from "./ui/chip";
import { SignalsDetails } from "./signals-details";
import { SIGNALS, STATUS_LABELS } from "@/verification";
import type { JobStatus, Signal } from "@/verification";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "—";

const relativeDays = (d: Date | null) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export interface PassportSalary {
  id: string;
  min: number | null;
  max: number | null;
  period: string | null;
  /**
   * Where this figure comes from, shown as a distinct tag next to it:
   *   "employer"  — parsed from the employer's own posting
   *   "extracted" — parsed by an automated fallback from the employer's own posting
   *   "pasted"    — only from text the user pasted into Check a Job; not confirmed
   */
  provenance: "employer" | "extracted" | "pasted";
}

export interface PassportSource {
  id: string;
  sourceName: string;
  employerOwned: boolean;
  url: string;
  lastVerifiedAt: Date | null;
  expiredAt: Date | null;
}

export interface PassportProps {
  isDemo: boolean;
  title: string;
  employerName: string;
  status: JobStatus;
  identityStatus: "CONFIRMED" | "PROBABLE" | "UNKNOWN" | null;
  employerDomain: string | null;
  salaries: PassportSalary[];
  vacancyStatement: string | null;
  vacancyStatementDerived: boolean;
  postedAt: Date | null;
  lastVerifiedAt: Date | null;
  sources: PassportSource[];
  signals: Signal[];
  overrideNote: string | null;
  overrideAt: Date | null;
  /** Render every signal expanded (job detail) vs. collapsed behind <details> (search card). */
  expanded?: boolean;
}

function money(n: number) {
  return n % 1 === 0 ? `$${n.toLocaleString("en-CA")}` : `$${n.toFixed(2)}`;
}

function SalaryLine({ s }: { s: PassportSalary }) {
  const range = s.min && s.max && s.min !== s.max ? `${money(s.min)}–${money(s.max)}` : money(s.max ?? s.min ?? 0);
  const per = s.period ? ` / ${s.period.toLowerCase()}` : "";
  return (
    <div className="flex flex-wrap items-center gap-2 tabular-nums">
      <span>
        {range}
        {per}
      </span>
      <SalaryEvidenceTag kind={s.provenance} />
    </div>
  );
}

/**
 * The Job Passport — one component shared by Check a Job, job detail, and
 * (condensed) search cards. Every claim on this page traces to a signal or a
 * source below; nothing here is invented.
 */
export function Passport(props: PassportProps) {
  const {
    isDemo, title, employerName, status, identityStatus, employerDomain, salaries,
    vacancyStatement, vacancyStatementDerived, postedAt, lastVerifiedAt, sources, signals,
    overrideNote, overrideAt, expanded = false,
  } = props;
  const staleWarning = lastVerifiedAt && Date.now() - lastVerifiedAt.getTime() > 7 * 86_400_000;
  const demoSuffix = isDemo ? " (demo)" : "";

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-[var(--surface)] p-5 shadow-[var(--shadow-1)]" aria-label="Job Passport">
      <h2 className="font-mono text-xs uppercase tracking-wide text-muted">Job Passport</h2>
      <h2 className="mt-1 font-display text-lg font-semibold text-fg">
        {title} · {employerName}
        {demoSuffix}
      </h2>

      <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-y-3 text-sm">
        <dt className="text-muted">Status</dt>
        <dd>
          <StatusChip status={status} demo={isDemo} />
        </dd>

        {overrideNote != null && (
          <>
            <dt className="text-muted">Reviewed</dt>
            <dd>
              Reviewed by Provenant staff on {fmt(overrideAt)}. {overrideNote}
            </dd>
          </>
        )}

        <dt className="text-muted">Employer</dt>
        <dd>
          {identityStatus === "CONFIRMED" ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              Identity confirmed{employerDomain ? ` (${employerDomain})` : ""}
            </span>
          ) : identityStatus === "PROBABLE" ? (
            <>We list this employer's own board, but haven't confirmed it's theirs.</>
          ) : (
            <>We haven't confirmed this employer's identity.</>
          )}
        </dd>

        <dt className="text-muted">Salary</dt>
        <dd className="flex flex-col gap-1.5">
          {salaries.length === 0 ? "Salary not disclosed." : salaries.map((s) => <SalaryLine key={s.id} s={s} />)}
        </dd>

        {vacancyStatement && (
          <>
            <dt className="text-muted">Vacancy</dt>
            <dd>
              “{vacancyStatement}”{vacancyStatementDerived && <span className="text-muted"> (extracted automatically)</span>}
            </dd>
          </>
        )}

        <dt className="text-muted">Posted</dt>
        <dd className="tabular-nums">{fmt(postedAt)}</dd>

        <dt className="text-muted">Last confirmed</dt>
        <dd className="tabular-nums">
          {fmt(lastVerifiedAt)}
          {staleWarning && <span className="text-warn-fg"> — may be closed</span>}
        </dd>

        <dt className="text-muted">Also found on</dt>
        <dd>
          {sources.length === 0
            ? "We haven't matched this to anything in our index."
            : sources.length === 1
              ? "This is the only source we found."
              : `${sources.length} sources`}
          {sources.length > 1 && (
            <ul className="mt-1 list-inside list-disc">
              {sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} className="text-accent underline" target="_blank" rel="noreferrer">
                    {s.sourceName}
                  </a>
                  {s.expiredAt ? " — no longer listed there" : s.lastVerifiedAt ? ` — confirmed ${relativeDays(s.lastVerifiedAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>

      <SignalsDetails
        context={`${employerName}:${title}`}
        expanded={expanded}
        summary={
          <>
            Signals — {signals.filter((s) => s.polarity === "POSITIVE").length} positive
            {signals.some((s) => s.polarity !== "POSITIVE") &&
              `, ${signals.filter((s) => s.polarity !== "POSITIVE").length} need${signals.filter((s) => s.polarity !== "POSITIVE").length === 1 ? "s" : ""} attention`}
          </>
        }
      >
        <ul className="mt-3 space-y-3">
          {signals.map((s, i) => {
            const def = SIGNALS[s.code];
            return (
              <li key={i} className="rounded-[var(--radius-sm)] border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{s.polarity === "POSITIVE" ? "✓" : s.polarity === "NEGATIVE" ? "✕" : "•"}</span>
                  <strong>{def?.label ?? s.code}</strong>
                </div>
                {def?.checked && <p className="mt-1 text-muted">{def.checked}</p>}
                <p className="mt-1">
                  {s.evidenceUrl ? (
                    <a href={s.evidenceUrl} className="text-accent underline" target="_blank" rel="noreferrer">
                      {s.evidenceText}
                    </a>
                  ) : (
                    s.evidenceText
                  )}
                </p>
                {def?.meaning && <p className="mt-1 text-muted">{def.meaning}</p>}
              </li>
            );
          })}
        </ul>
      </SignalsDetails>

      <p className="mt-4 text-sm">
        <a href="/docs/verification" className="text-accent underline">
          How verification works
        </a>
      </p>
    </section>
  );
}
