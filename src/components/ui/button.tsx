import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "link" | "secondary-inverse";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:brightness-95",
  secondary: "border border-line text-fg hover:bg-surface-raised",
  ghost: "text-fg hover:bg-surface-raised",
  link: "text-accent underline underline-offset-2 hover:no-underline",
  /** For use on a dark/coloured background (e.g. CtaBand, a dark Hero) — plain "secondary" is illegible there. */
  "secondary-inverse": "border border-[var(--primary-contrast)]/40 text-[var(--primary-contrast)] hover:bg-[var(--primary-contrast)]/10",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-colors duration-[var(--duration-fast)] ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

/** Button (primary/secondary/ghost/link), sizes sm/md/lg, loading + disabled states. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${base} ${VARIANT[variant]} ${variant === "link" ? "" : SIZE[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Same visual variants as an <a>/<Link>, for CTAs that navigate. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  children,
  className = "",
  external = false,
}: CommonProps & { href: string; external?: boolean }) {
  const cls = `${base} ${VARIANT[variant]} ${variant === "link" ? "" : SIZE[size]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
