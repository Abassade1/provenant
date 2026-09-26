"use client";

import { useTransition } from "react";
import { deleteSavedSearch } from "@/app/actions/saved";

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => { void deleteSavedSearch(id); })}
      className="text-xs text-muted underline disabled:opacity-50"
    >
      Remove
    </button>
  );
}
