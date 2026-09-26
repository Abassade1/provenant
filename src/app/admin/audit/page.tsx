import { desc, eq } from "drizzle-orm";
import { AdminNav } from "@/components/admin-nav";
import { getDb } from "@/db/client";
import { adminAuditLog, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });

export default async function AuditLogPage() {
  await requireAdmin();
  const db = getDb();

  const entries = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entity: adminAuditLog.entity,
      entityId: adminAuditLog.entityId,
      before: adminAuditLog.before,
      after: adminAuditLog.after,
      createdAt: adminAuditLog.createdAt,
      actorEmail: user.email,
    })
    .from(adminAuditLog)
    .leftJoin(user, eq(user.id, adminAuditLog.actorUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(200);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav active="/admin/audit" />
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-muted">Every admin action: who, what, before, after, when. Most recent 200.</p>

      <ul className="mt-4 space-y-2 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="rounded border border-line p-3">
            <div>
              <strong>{e.action}</strong> on {e.entity} <span className="font-mono text-xs">{e.entityId}</span>
            </div>
            <div className="text-muted">
              {e.actorEmail ?? "dev bypass"} · {fmt(e.createdAt)}
            </div>
            {(e.before != null || e.after != null) && (
              <div className="mt-1 font-mono text-xs text-muted">
                {e.before != null && <div>before: {JSON.stringify(e.before)}</div>}
                {e.after != null && <div>after: {JSON.stringify(e.after)}</div>}
              </div>
            )}
          </li>
        ))}
        {entries.length === 0 && <li className="text-muted">No admin actions yet.</li>}
      </ul>
    </main>
  );
}
