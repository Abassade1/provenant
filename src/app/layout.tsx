import type { Metadata } from "next";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provenant",
  description: "Before you apply, know what you're applying to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="min-h-screen antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--bg)]"
        >
          Skip to content
        </a>
        <DemoBanner />
        <SiteHeader />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
