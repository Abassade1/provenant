import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { StatusChip } from "@/components/ui/chip";
import type { JobStatus } from "@/verification";
import type { SearchResultRow } from "@/evidence/search";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }) : "—");
const relDays = (d: Date | null) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
};

function money(n: number) {
  return n % 1 === 0 ? `$${n.toLocaleString("en-CA")}` : `$${n.toFixed(2)}`;
}

export function JobCard({ job, saved, signedIn }: { job: SearchResultRow; saved: boolean; signedIn: boolean }) {
  const salary =
    job.salaryMin != null || job.salaryMax != null
      ? `${job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax ? `${money(job.salaryMin)}–${money(job.salaryMax)}` : money((job.salaryMax ?? job.salaryMin)!)}${job.salaryPeriod ? ` / ${job.salaryPeriod.toLowerCase()}` : ""}`
      : "Salary not disclosed";

  return (
    <li className="rounded-[var(--radius-md)] border border-line bg-[var(--surface)] p-4 shadow-[var(--shadow-1)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/jobs/${job.id}`} className="font-display text-base font-medium text-accent underline">
            {job.title}
          </Link>
          <p className="text-sm">
            {job.employerName}
            {job.employerIsDemo && <span className="text-muted"> (demo)</span>}
            {job.city && <> · {job.city}{job.province ? `, ${job.province}` : ""}</>}
            {!job.city && job.remoteType === "REMOTE" && <> · Remote</>}
          </p>
        </div>
        <SaveButton jobId={job.id} initialSaved={saved} signedIn={signedIn} />
      </div>

      <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <div className="tabular-nums">{salary}</div>
        <div className="tabular-nums">Posted {fmtDate(job.postedAt ?? job.firstSeenAt)}</div>
        <div className="tabular-nums">Last confirmed {relDays(job.lastVerifiedAt) ?? "never"}</div>
        <div>
          <StatusChip status={job.status as JobStatus} demo={job.isDemo} />
        </div>
        <div>Found on {job.sourceCount} source{job.sourceCount === 1 ? "" : "s"}</div>
      </dl>
    </li>
  );
}
