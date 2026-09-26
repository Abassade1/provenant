"use client";

import { useState, useTransition } from "react";
import { createSavedSearch } from "@/app/actions/saved";
import type { SearchFilters } from "@/lib/search-params";

export function SaveSearchForm({ filters, signedIn }: { filters: SearchFilters; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!signedIn) {
    return (
      <a href="/sign-in" className="text-sm text-accent underline">
        Sign in to save this search and get alerts
      </a>
    );
  }

  // Collapsing on success (instead of leaving the form open) previously threw the
  // confirmation away in the same render it appeared in, since the notice only
  // rendered inside the "open" branch — show it here, outside that branch, once saved.
  if (saved) {
    return (
      <span role="status" className="text-sm text-muted">
        {notice}
      </span>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent underline">
        Save this search
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createSavedSearch(name, filters);
          if ("error" in result) {
            setNotice(result.error);
          } else {
            setNotice("Saved. You'll get an alert when new matches appear.");
            setSaved(true);
          }
        });
      }}
    >
      <label className="sr-only" htmlFor="saved-search-name">
        Name this search
      </label>
      <input
        id="saved-search-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Toronto software jobs"
        className="rounded border border-line bg-transparent px-2 py-1 text-sm"
        maxLength={120}
      />
      <button type="submit" disabled={pending} className="rounded border border-line px-2 py-1 text-sm disabled:opacity-50">
        Save
      </button>
      {notice && (
        <span role="status" className="text-xs text-muted">
          {notice}
        </span>
      )}
    </form>
  );
}
