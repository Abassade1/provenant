"use client";

import { ErrorState } from "./states";

/**
 * Wraps ErrorState's onRetry with a locally-defined handler so /design (a
 * Server Component) never passes a function prop across the RSC boundary —
 * real callers with real retry logic are already inside a Client Component.
 */
export function ErrorStateDemo() {
  return <ErrorState description="We couldn't load your results. Please try again." onRetry={() => {}} />;
}
