"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/app/actions/account";
import { authClient } from "@/auth/client";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="block w-full rounded border border-[var(--warn-fg)] px-4 py-2 text-left text-sm text-[var(--warn-fg)]">
        Delete my account
      </button>
    );
  }
  return (
    <div className="rounded border border-[var(--warn-fg)] p-3 text-sm">
      <p>This permanently deletes your profile, saved jobs, saved searches and checks. This can't be undone.</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteAccount();
              await authClient.signOut();
              router.push("/");
              router.refresh();
            })
          }
          className="rounded bg-[var(--warn-fg)] px-3 py-1 text-[var(--bg)] disabled:opacity-50"
        >
          Yes, delete everything
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
