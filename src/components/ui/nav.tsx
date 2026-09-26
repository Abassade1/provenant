"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "./button";

export interface NavColumn {
  title: string;
  links: { label: string; href: string; description?: string }[];
}

export function Nav({ logo = "Provenant", columns, loginHref = "/sign-in", ctaHref = "/check", ctaLabel = "Check a job" }: { logo?: string; columns: NavColumn[]; loginHref?: string; ctaHref?: string; ctaLabel?: string }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[var(--content-max-width)] items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="font-display text-lg font-semibold text-fg">
          {logo}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {columns.map((col) => (
            <div key={col.title} className="relative" onMouseEnter={() => setOpenMenu(col.title)} onMouseLeave={() => setOpenMenu(null)}>
              <button
                type="button"
                aria-expanded={openMenu === col.title}
                onClick={() => setOpenMenu(openMenu === col.title ? null : col.title)}
                className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-fg hover:bg-surface-raised"
              >
                {col.title}
              </button>
              {openMenu === col.title && (
                <div className="absolute left-0 top-full w-64 rounded-[var(--radius-md)] border border-line bg-[var(--surface)] p-2 shadow-[var(--shadow-2)]">
                  {col.links.map((l) => (
                    <Link key={l.href} href={l.href} className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-surface-raised">
                      <div className="font-medium text-fg">{l.label}</div>
                      {l.description && <div className="text-xs text-muted">{l.description}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href={loginHref} className="text-sm text-muted hover:text-fg">
            Log in
          </Link>
          <ButtonLink href={ctaHref} size="sm">
            {ctaLabel}
          </ButtonLink>
        </div>

        <Button variant="ghost" size="sm" className="md:hidden" aria-expanded={mobileOpen} aria-controls="mobile-drawer" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          <span className="sr-only">Menu</span>
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-drawer" className="border-t border-line bg-[var(--surface)] px-4 py-4 md:hidden">
          {columns.map((col) => (
            <div key={col.title} className="py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{col.title}</div>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className="block py-2 text-sm text-fg" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <Link href={loginHref} className="text-sm text-muted">
              Log in
            </Link>
            <ButtonLink href={ctaHref} size="sm">
              {ctaLabel}
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
