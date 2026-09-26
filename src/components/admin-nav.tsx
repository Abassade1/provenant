import Link from "next/link";

const LINKS = [
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/sources", label: "Source health" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mb-6 flex gap-4 border-b border-line pb-3 text-sm">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.href === active ? "font-medium text-accent" : "text-muted hover:underline"}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
