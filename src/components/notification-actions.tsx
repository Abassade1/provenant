"use client";

import { useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => markNotificationRead(id))}
      className="shrink-0 text-xs text-muted underline disabled:opacity-50"
    >
      Mark read
    </button>
  );
}

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => markAllNotificationsRead())}
      className="text-sm text-accent underline disabled:opacity-50"
    >
      Mark all read
    </button>
  );
}
