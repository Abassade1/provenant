import type { Metadata } from "next";
import { DemoBanner } from "@/components/DemoBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provenant",
  description: "Before you apply, know what you're applying to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="min-h-screen antialiased">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
