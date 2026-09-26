import { and, eq } from "drizzle-orm";
import { FileCheck, KeyRound, Lock, RefreshCw, ScanSearch, ShieldCheck, ShieldAlert, Users2 } from "lucide-react";
import { getDb } from "@/db/client";
import { canonicalJob } from "@/db/schema";
import { loadPassportProps } from "@/evidence/passport-data";
import { searchJobs } from "@/evidence/search";
import { searchFiltersSchema } from "@/lib/search-params";
import { Passport } from "@/components/passport";
import { JobCard } from "@/components/job-card";
import { FeatureAccordion } from "@/components/feature-accordion";
import { ButtonLink } from "@/components/ui/button";
import { CtaBand } from "@/components/ui/cta-band";
import { Dotwork } from "@/components/ui/dotwork";
import { Footer } from "@/components/ui/footer";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustBadgeCard } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SOURCE_TYPES = ["Employer ATS boards", "Government open data", "Employer career pages", "Employer-submitted postings"];

const PROBLEM_ROW_1 = ['Posted 40 days ago — still open?', 'Salary: "competitive"', "Recruiter asked me to move to WhatsApp", "Apply link redirects twice"];
const PROBLEM_ROW_2 = ["Reposted on 4 different boards", "No company name anywhere", "Asked to pay for a background check", "Interview entirely over text message"];

const iconCls = "size-4";
const HOW_IT_WORKS = [
  { icon: <ShieldCheck className={iconCls} aria-hidden />, title: "Rule-based verification", description: "A published rule table decides status — first matching rule wins. Never a summed score, never a black box." },
  { icon: <Lock className={iconCls} aria-hidden />, title: "Payment isolation", description: "The verification code can't read billing, plan or sponsorship data at all — enforced in code, and a test asserts it." },
  { icon: <FileCheck className={iconCls} aria-hidden />, title: "Salary provenance", description: "Every figure is labelled employer advertised, extracted automatically, or from pasted text — never blended together." },
  { icon: <RefreshCw className={iconCls} aria-hidden />, title: "Freshness rechecks", description: "Every active source is rechecked on a schedule — more often for postings under 7 days old." },
  { icon: <ScanSearch className={iconCls} aria-hidden />, title: "Duplicate detection", description: "Similar postings are merged automatically above a threshold, or flagged for staff review below it." },
  { icon: <KeyRound className={iconCls} aria-hidden />, title: "Employer identity", description: "We confirm an ATS board belongs to an employer by checking their own careers page links back to it." },
  { icon: <ShieldAlert className={iconCls} aria-hidden />, title: "Scam-pattern detection", description: "Upfront payment requests, off-platform contact, lookalike domains, apply-link mismatches — named, not accused." },
  { icon: <Users2 className={iconCls} aria-hidden />, title: "Staff review", description: "Every manual override is audited — who, what, before, after, when — and shown on the Passport itself." },
];

export default async function Home() {
  const db = getDb();
  const [demoJob] = await db
    .select({ id: canonicalJob.id })
    .from(canonicalJob)
    .where(and(eq(canonicalJob.status, "VERIFIED"), eq(canonicalJob.isDemo, true)))
    .limit(1);
  const passportProps = demoJob ? await loadPassportProps(db, demoJob.id) : null;

  const previewSearch = await searchJobs(db, searchFiltersSchema.parse({}), { unpaged: false });
  const previewJobs = previewSearch.rows.slice(0, 2);

  return (
    <main>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-[var(--bg)]">
        <Dotwork tone="accent" className="pointer-events-none absolute inset-x-0 top-0 h-full w-full opacity-60" />
        <div className="relative mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-10 px-4 py-[var(--section-py)] md:grid-cols-2 md:px-8">
          <div className="flex flex-col items-start gap-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">Before you apply</div>
            <h1 className="font-display text-[length:var(--text-display)] font-semibold leading-[1.1] text-fg">
              Know what you&apos;re applying to.
            </h1>
            <p className="max-w-[46ch] text-[length:var(--text-body-lg)] text-muted">
              Paste any job link and see where it really came from, whether it&apos;s still open, and what the
              salary evidence says.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ButtonLink href="/check">Check a job</ButtonLink>
              <ButtonLink href="/search" variant="secondary">
                Search verified jobs
              </ButtonLink>
            </div>
            <ButtonLink href="/docs/verification" variant="link">
              How verification works
            </ButtonLink>
          </div>
          <div className="relative">
            {passportProps ? (
              <Passport {...passportProps} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-[var(--radius-lg)] bg-surface-raised text-sm text-muted">
                Job Passport
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== Source strip ===== */}
      <div className="border-y border-line bg-[var(--surface)] py-6">
        <Marquee variant="text" items={SOURCE_TYPES} />
      </div>

      {/* ===== Problem ===== */}
      <section className="bg-[var(--primary)] py-16 text-[var(--primary-contrast)]">
        <div className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-8 px-4 md:px-8">
          <div className="max-w-[640px] text-center">
            <h2 className="font-display text-[length:var(--text-h2)] font-semibold">The problem isn&apos;t just fake jobs.</h2>
            <p className="mt-3 text-[length:var(--text-body-lg)] opacity-80">
              Postings go stale, get reposted across a dozen sites, and a growing share of scams never touch a job
              board at all — they arrive by text, WhatsApp and social media, where a search index alone can&apos;t
              reach them.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4">
            <Marquee items={PROBLEM_ROW_1} />
            <Marquee items={PROBLEM_ROW_2} direction="reverse" />
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="py-[var(--section-py)]">
        <div className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-10 px-4 md:px-8">
          <SectionHeader eyebrow="How it works" title="Rule-based, deterministic, explainable" subtitle="Every signal below links to what we checked, when, and what it means." />
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
            <FeatureAccordion items={HOW_IT_WORKS} />
            <div className="flex items-center justify-center rounded-[var(--radius-lg)] bg-surface-raised p-6">
              {previewJobs.length > 0 ? (
                <ul className="w-full space-y-3">
                  {previewJobs.map((job) => (
                    <JobCard key={job.id} job={job} saved={false} signedIn={false} />
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">Search results panel</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Product showcase — full flow ===== */}
      <section className="border-t border-line bg-[var(--surface)] py-[var(--section-py)]">
        <div className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-8 px-4 md:px-8">
          <SectionHeader eyebrow="The Job Passport" title="One Passport, wherever you find the job" subtitle="The same evidence whether you found it through Search or pasted a link from somewhere else. Every row expands to what we checked. There is no single hidden score." />
          {passportProps && (
            <div className="w-full max-w-2xl">
              <Passport {...passportProps} expanded />
            </div>
          )}
        </div>
      </section>

      {/* ===== Trust & security ===== */}
      <section className="py-[var(--section-py)]">
        <div className="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-10 px-4 md:px-8">
          <SectionHeader eyebrow="Trust & security" title="Only the claims we can back" />
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            <TrustBadgeCard
              icon={Lock}
              title="Payment never affects verification"
              lines={["No employer, recruiter or job seeker can pay for a better status.", "Enforced in code — the verification module can't read billing data."]}
            />
            <TrustBadgeCard
              icon={ShieldCheck}
              title="Your pasted text is encrypted"
              lines={["Check text is encrypted at rest and never logged in the raw.", "Deleted automatically after a limited retention period."]}
            />
            <TrustBadgeCard
              icon={FileCheck}
              title="Every admin action is audited"
              lines={["Staff overrides are logged — who, what, before, after, when.", "Shown on the Passport itself, never hidden."]}
            />
          </div>
        </div>
      </section>

      {/* ===== Why we built this ===== */}
      <section className="border-t border-line bg-[var(--surface)] py-[var(--section-py)]">
        <div className="mx-auto max-w-[640px] px-4 text-center md:px-8">
          <h2 className="font-display text-[length:var(--text-h2)] font-semibold text-fg">Why we built this</h2>
          <p className="mt-4 text-[length:var(--text-body-lg)] text-muted">[TODO: founder note — why Provenant exists, written by the team, no fake names or photos]</p>
        </div>
      </section>

      <CtaBand title="Know before you apply." cta={<ButtonLink href="/check" variant="secondary-inverse">Check a job</ButtonLink>} />

      <Footer />
    </main>
  );
}
