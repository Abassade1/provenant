import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { FilterChip, StatusChip, SalaryEvidenceTag } from "@/components/ui/chip";
import { Card, FeatureCard, TrustBadgeCard } from "@/components/ui/card";
import { CtaBand } from "@/components/ui/cta-band";
import { Dotwork } from "@/components/ui/dotwork";
import { EmptyState, JobCardSkeleton } from "@/components/ui/states";
import { ErrorStateDemo } from "@/components/ui/design-demos";
import { Footer } from "@/components/ui/footer";
import { Hero } from "@/components/ui/hero";
import { Input, SearchBar, Select } from "@/components/ui/input";
import { Marquee } from "@/components/ui/marquee";
import { Nav } from "@/components/ui/nav";
import { SectionHeader } from "@/components/ui/section-header";
import type { JobStatus } from "@/verification";

export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "STALE", "EXPIRED", "REVIEW_REQUIRED", "HIGH_RISK"];
const COLOR_TOKENS: { name: string; varName: string }[] = [
  { name: "bg", varName: "--bg" },
  { name: "surface", varName: "--surface" },
  { name: "surface-raised", varName: "--surface-raised" },
  { name: "text", varName: "--text" },
  { name: "text-muted", varName: "--text-muted" },
  { name: "border", varName: "--border" },
  { name: "primary", varName: "--primary" },
  { name: "accent", varName: "--accent" },
  { name: "success", varName: "--success" },
  { name: "warning", varName: "--warning" },
  { name: "danger", varName: "--danger" },
  { name: "info", varName: "--info" },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-12">
      <div className="mx-auto max-w-[var(--content-max-width)] px-4 md:px-8">
        <h2 className="font-display text-xl font-semibold text-fg">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/** Dev-only reference: every token and component, all states, light + dark (toggle your OS theme). */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="pb-24">
      <div className="border-b border-line bg-[var(--surface)] px-4 py-6 md:px-8">
        <h1 className="font-display text-2xl font-semibold text-fg">Provenant design system</h1>
        <p className="mt-1 text-sm text-muted">
          Dev-only. Every token and component below, in every state. Toggle your OS/browser colour scheme to check
          dark mode — there's no in-page switch (tokens.css also supports a <code>data-theme</code> override for a
          future manual toggle).
        </p>
      </div>

      <Block title="Colour tokens">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {COLOR_TOKENS.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className="h-16 rounded-[var(--radius-sm)] border border-line" style={{ background: `var(${t.varName})` }} />
              <div className="font-mono text-xs text-muted">{t.name}</div>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Type scale">
        <div className="flex flex-col gap-3">
          <div style={{ fontSize: "var(--text-display)" }} className="font-display font-semibold">Display</div>
          <div style={{ fontSize: "var(--text-h1)" }} className="font-display font-semibold">Heading 1</div>
          <div style={{ fontSize: "var(--text-h2)" }} className="font-display font-semibold">Heading 2</div>
          <div style={{ fontSize: "var(--text-h3)" }} className="font-display font-semibold">Heading 3</div>
          <div style={{ fontSize: "var(--text-h4)" }} className="font-display font-semibold">Heading 4</div>
          <div style={{ fontSize: "var(--text-body-lg)" }}>Body large — the quick brown fox jumps over the lazy dog.</div>
          <div style={{ fontSize: "var(--text-body)" }}>Body — the quick brown fox jumps over the lazy dog.</div>
          <div style={{ fontSize: "var(--text-small)" }} className="text-muted">Small — the quick brown fox jumps over the lazy dog.</div>
          <div style={{ fontSize: "var(--text-caption)" }} className="text-muted">Caption — the quick brown fox jumps over the lazy dog.</div>
          <div className="mt-2 tabular-nums text-sm">Tabular numerals: $72,000–$90,000 · Sep 12, 2026 · 03 days</div>
        </div>
      </Block>

      <Block title="Radius &amp; elevation">
        <div className="flex flex-wrap gap-6">
          <div className="size-20 rounded-[var(--radius-sm)] border border-line bg-surface-raised" />
          <div className="size-20 rounded-[var(--radius-md)] border border-line bg-surface-raised" />
          <div className="size-20 rounded-[var(--radius-lg)] border border-line bg-surface-raised" />
          <div className="flex size-20 items-center justify-center rounded-[var(--radius-full)] border border-line bg-surface-raised text-xs">pill</div>
          <div className="size-20 rounded-[var(--radius-md)] bg-[var(--surface)] shadow-[var(--shadow-1)]" />
          <div className="size-20 rounded-[var(--radius-md)] bg-[var(--surface)] shadow-[var(--shadow-2)]" />
          <div className="size-20 rounded-[var(--radius-md)] bg-[var(--surface)] shadow-[var(--shadow-3)]" />
        </div>
      </Block>

      <Block title="Dotwork graphic">
        <div className="h-40 overflow-hidden rounded-[var(--radius-md)] bg-surface-raised">
          <Dotwork className="h-full w-full" />
        </div>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <ButtonLink href="/check" variant="secondary">As a link</ButtonLink>
        </div>
      </Block>

      <Block title="Inputs">
        <div className="flex max-w-md flex-col gap-3">
          <Input placeholder="Text input" />
          <Input placeholder="Disabled" disabled />
          <SearchBar placeholder="Search jobs…" />
          <Select defaultValue="">
            <option value="" disabled>Choose one…</option>
            <option>Ontario</option>
            <option>British Columbia</option>
          </Select>
        </div>
      </Block>

      <Block title="Filter chips">
        <div className="flex flex-wrap gap-2">
          <FilterChip active>Remote</FilterChip>
          <FilterChip>Full-time</FilterChip>
          <FilterChip>Verified only</FilterChip>
        </div>
      </Block>

      <Block title="Status chips — icon + text, never colour alone">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
          <StatusChip status="VERIFIED" demo />
        </div>
      </Block>

      <Block title="Salary evidence tags">
        <div className="flex flex-wrap gap-2">
          <SalaryEvidenceTag kind="employer" />
          <SalaryEvidenceTag kind="extracted" />
          <SalaryEvidenceTag kind="pasted" />
        </div>
      </Block>

      <Block title="Cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <FeatureCard icon={ShieldCheck} title="Rule-based verification" description="A published rule table, not a black-box score." />
          <TrustBadgeCard icon={Lock} title="Payment never affects verification" lines={["No employer can pay for a better status.", "Enforced in code, not just policy."]} />
          <Card>
            <div className="text-sm text-muted">Plain card</div>
          </Card>
        </div>
      </Block>

      <Block title="Empty, loading &amp; error states">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <EmptyState icon={AlertTriangle} title="No saved jobs yet" description="Save a job from search to see it here." />
          <div className="flex flex-col gap-3">
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
          <ErrorStateDemo />
        </div>
      </Block>

      <Block title="Marquee — pill row (pause on hover, respects reduced motion)">
        <Marquee items={["Posted 40 days ago — still open?", "Salary: \"competitive\"", "Recruiter asked me to move to WhatsApp"]} />
      </Block>

      <Block title="Section header">
        <SectionHeader eyebrow="How it works" title="Rule-based, deterministic, explainable" subtitle="Every signal links to the evidence behind it." />
      </Block>

      <Block title="Nav">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
          <Nav
            columns={[
              { title: "Product", links: [{ label: "Check a job", href: "/check", description: "Paste a link or text" }, { label: "Search", href: "/search", description: "Browse verified jobs" }] },
              { title: "Company", links: [{ label: "How verification works", href: "/docs/verification" }] },
            ]}
          />
        </div>
      </Block>

      <Block title="Hero">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
          <Hero
            eyebrow="Before you apply"
            title="Know what you're applying to."
            subtitle="Paste any job link and see where it really came from, whether it's still open, and what the salary evidence says."
            primaryCta={<ButtonLink href="/check">Check a job</ButtonLink>}
            secondaryCta={<ButtonLink href="/search" variant="secondary">Search verified jobs</ButtonLink>}
            visual={<div className="flex h-64 items-center justify-center rounded-[var(--radius-lg)] bg-surface-raised text-sm text-muted">Job Passport panel</div>}
          />
        </div>
      </Block>

      <Block title="CTA band">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
          <CtaBand title="Know before you apply." cta={<ButtonLink href="/check" variant="secondary-inverse">Check a job</ButtonLink>} />
        </div>
      </Block>

      <Block title="Footer">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
          <Footer />
        </div>
      </Block>
    </main>
  );
}
