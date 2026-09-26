"use client";

import Link from "next/link";
import { Button } from "./button";
import { Input } from "./input";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Check a job", href: "/check" },
      { label: "Search verified jobs", href: "/search" },
      { label: "How verification works", href: "/docs/verification" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Saved jobs & alerts", href: "/saved" },
      { label: "Notifications", href: "/notifications" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "Account", href: "/account" }],
  },
  {
    title: "Legal",
    links: [{ label: "How verification works", href: "/docs/verification" }],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-[var(--surface)]">
      <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-3">
            <div className="font-display text-lg font-semibold text-fg">Provenant</div>
            <p className="max-w-[32ch] text-sm text-muted">Before you apply, know what you're applying to.</p>
            <form className="mt-2 flex max-w-xs gap-2" onSubmit={(e) => e.preventDefault()}>
              <Input type="email" placeholder="you@example.com" aria-label="Email for updates" />
              <Button type="submit" variant="secondary" size="sm">
                Join
              </Button>
            </form>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-fg">{col.title}</div>
              {col.links.map((l) => (
                <Link key={l.href + l.label} href={l.href} className="text-sm text-muted hover:text-fg">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-line pt-6 text-xs text-muted">
          © {new Date().getFullYear()} Provenant. Built for job seekers in Canada.
        </div>
      </div>
    </footer>
  );
}
