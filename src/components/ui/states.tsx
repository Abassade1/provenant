import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-line px-6 py-12 text-center">
      <Icon className="size-8 text-muted" aria-hidden />
      <div className="font-display text-base font-semibold text-fg">{title}</div>
      <p className="max-w-[40ch] text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-line bg-danger-bg px-6 py-12 text-center" role="alert">
      <AlertCircle className="size-8 text-danger" aria-hidden />
      <div className="font-display text-base font-semibold text-fg">{title}</div>
      <p className="max-w-[40ch] text-sm text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-sm)] bg-surface-raised ${className}`} />;
}

/** Skeleton shaped like a JobCard row, for search-results loading states. */
export function JobCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] border border-line p-4">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}
