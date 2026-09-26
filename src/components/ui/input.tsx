import { Search } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-[var(--radius-sm)] border border-line bg-[var(--surface)] px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** A search input with a leading icon — same field styling, no separate button. */
export function SearchBar({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" className={`${fieldBase} pl-9 ${className}`} {...rest} />
    </div>
  );
}
