import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { notification } from "@/db/schema";
import { MarkReadButton, MarkAllReadButton } from "@/components/notification-actions";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const items = await getDb()
    .select()
    .from(notification)
    .where(eq(notification.userId, session.user.id))
    .orderBy(desc(notification.createdAt))
    .limit(100);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {items.some((n) => !n.readAt) && <MarkAllReadButton />}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-muted">
          Nothing yet.{" "}
          <Link href="/search" className="text-accent underline">
            Save a search
          </Link>{" "}
          and we&apos;ll let you know when new matches appear.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded border p-3 text-sm ${n.readAt ? "border-line" : "border-[var(--accent)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{fmt(n.createdAt)}</p>
                  {n.link && (
                    <Link href={n.link} className="mt-1 inline-block text-accent underline">
                      View
                    </Link>
                  )}
                </div>
                {!n.readAt && <MarkReadButton id={n.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
