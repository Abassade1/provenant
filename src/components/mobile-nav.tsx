"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Hamburger + slide-down drawer for the real site header (session-aware content passed as children). */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls="mobile-nav-drawer" onClick={() => setOpen((v) => !v)}>
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">Menu</span>
      </Button>
      {open && (
        <div id="mobile-nav-drawer" className="absolute inset-x-0 top-full border-b border-line bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-2)]" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
