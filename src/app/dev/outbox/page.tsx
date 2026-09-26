import { notFound } from "next/navigation";
import { devOutbox } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Dev convenience: no email provider is connected, so magic links land here instead of an inbox. */
export default function DevOutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const messages = devOutbox();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Dev email outbox</h1>
      <p className="mt-1 text-sm text-muted">
        No email provider is connected in this environment. Magic links and other outbound email land here instead of
        an inbox — dev only, never available in production.
      </p>
      <ul className="mt-6 space-y-3">
        {messages.map((m, i) => (
          <li key={i} className="rounded border border-line p-3 text-sm">
            <div className="text-muted">
              {m.sentAt} → {m.to}
            </div>
            <div className="font-medium">{m.subject}</div>
            {m.url && (
              <a href={m.url} className="mt-1 block break-all text-accent underline">
                {m.url}
              </a>
            )}
          </li>
        ))}
        {messages.length === 0 && <li className="text-muted">Nothing sent yet.</li>}
      </ul>
    </main>
  );
}
