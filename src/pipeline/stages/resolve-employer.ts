import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { employer, employerAlias, employerDomain } from "@/db/schema";
import { slugify } from "@/lib/text";
import type { SourceDescriptor } from "@/sources/types";
import type { NormalizedPosting } from "./normalize";

export function normalizeEmployerName(name: string): string {
  return slugify(
    name.replace(/\b(inc|incorporated|ltd|limited|corp|corporation|llc|ulc|co|company|ltée|ltee)\.?$/i, ""),
  );
}

/**
 * PHASE 2 (placeholder): find-or-create the employer from the source's
 * employer hint (employer-owned boards) or the posting's employer name.
 * Identity is always UNKNOWN here. Phase 3 adds domain ↔ board evidence and
 * the CONFIRMED / PROBABLE rules.
 */
export async function resolveEmployer(
  db: DB,
  descriptor: SourceDescriptor,
  posting: NormalizedPosting,
): Promise<string> {
  const name = descriptor.employerHint?.name ?? posting.employerName;
  const aliasKey = normalizeEmployerName(name);
  const isDemo = descriptor.isDemo;

  const byAlias = await db
    .select({ id: employerAlias.employerId })
    .from(employerAlias)
    .where(eq(employerAlias.aliasNormalized, aliasKey))
    .limit(1);
  if (byAlias[0]) return byAlias[0].id;

  const [created] = await db
    .insert(employer)
    .values({
      slug: aliasKey,
      displayName: name,
      primaryDomain: descriptor.employerHint?.domain ?? null,
      identityStatus: "UNKNOWN",
      isDemo,
    })
    .onConflictDoUpdate({ target: employer.slug, set: { updatedAt: new Date() } })
    .returning({ id: employer.id });
  const employerId = created!.id;

  await db
    .insert(employerAlias)
    .values({ employerId, alias: name, aliasNormalized: aliasKey, isDemo })
    .onConflictDoNothing();

  const domain = descriptor.employerHint?.domain;
  if (domain) {
    await db
      .insert(employerDomain)
      .values({ employerId, domain, kind: "PRIMARY", isDemo })
      .onConflictDoNothing();
  }
  if (descriptor.type === "ATS_PUBLIC_BOARD" || descriptor.type === "DEMO") {
    const boardDomain = new URL(posting.url).hostname;
    const existing = await db
      .select({ id: employerDomain.id })
      .from(employerDomain)
      .where(and(eq(employerDomain.employerId, employerId), eq(employerDomain.domain, boardDomain)))
      .limit(1);
    if (!existing[0]) {
      await db
        .insert(employerDomain)
        .values({ employerId, domain: boardDomain, kind: "ATS_BOARD", isDemo })
        .onConflictDoNothing();
    }
  }
  return employerId;
}
