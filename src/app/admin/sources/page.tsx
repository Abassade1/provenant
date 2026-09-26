import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { AdminNav } from "@/components/admin-nav";
import { getDb } from "@/db/client";
import { employer, ingestionError, source } from "@/db/schema";
import { requireAdminDev } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "never";

export default async function SourceHealthPage() {
  requireAdminDev();
  const db = getDb();

  const [sources, errors] = await Promise.all([
    db
      .select({
        id: source.id,
        key: source.key,
        type: source.type,
        name: source.name,
        employerOwned: source.employerOwned,
        enabled: source.enabled,
        lastSuccessAt: source.lastSuccessAt,
        termsReference: source.termsReference,
        identityStatus: employer.identityStatus,
        openErrors: sql<number>`(select count(*)::int from ${ingestionError} where ${ingestionError.sourceId} = ${source.id} and ${ingestionError.deadLetteredAt} is not null and ${ingestionError.resolvedAt} is null)`,
      })
      .from(source)
      .leftJoin(employer, eq(employer.id, source.employerId))
      .orderBy(source.provider, source.name),
    db
      .select({
        id: ingestionError.id,
        sourceKey: source.key,
        stage: ingestionError.stage,
        message: ingestionError.message,
        retryCount: ingestionError.retryCount,
        deadLetteredAt: ingestionError.deadLetteredAt,
      })
      .from(ingestionError)
      .innerJoin(source, eq(source.id, ingestionError.sourceId))
      .where(and(sql`${ingestionError.deadLetteredAt} is not null`, isNull(ingestionError.resolvedAt)))
      .orderBy(desc(ingestionError.deadLetteredAt))
      .limit(100),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav active="/admin/sources" />
      <h1 className="text-2xl font-semibold">Source health</h1>

      <table className="mt-4 w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            {["Source", "Type", "Owned by employer", "Identity", "Enabled", "Last success", "Open errors", "Terms"].map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-b border-line align-top">
              <td className="py-2 pr-4">{s.name}</td>
              <td className="py-2 pr-4">{s.type}</td>
              <td className="py-2 pr-4">{s.employerOwned ? "Yes" : "No"}</td>
              <td className="py-2 pr-4">{s.identityStatus ?? "—"}</td>
              <td className="py-2 pr-4">{s.enabled ? "Yes" : "No"}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{fmt(s.lastSuccessAt)}</td>
              <td className="py-2 pr-4">{s.openErrors}</td>
              <td className="max-w-xs truncate py-2 pr-4 text-xs text-muted" title={s.termsReference}>
                {s.termsReference}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-lg font-semibold">Dead-lettered errors ({errors.length})</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {errors.map((e) => (
          <li key={e.id} className="rounded border border-line p-3">
            <div className="text-muted">
              {e.sourceKey} · {e.stage} · {e.retryCount} retries · {fmt(e.deadLetteredAt)}
            </div>
            <div className="mt-1 font-mono text-xs">{e.message}</div>
          </li>
        ))}
        {errors.length === 0 && <li className="text-muted">No open errors.</li>}
      </ul>
    </main>
  );
}
