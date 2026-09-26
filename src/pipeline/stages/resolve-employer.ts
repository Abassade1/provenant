import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { employer, employerAlias, employerDomain, source, type IdentityEvidence } from "@/db/schema";
import { slugify } from "@/lib/text";
import type { EmployerHint, IdentityProbe, JobSource, SourceDescriptor } from "@/sources/types";
import type { NormalizedPosting } from "./normalize";

export function normalizeEmployerName(name: string): string {
  return slugify(
    name
      .replace(/\((demo|fixture)\)/gi, "")
      .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|llc|ulc|co|company|ltée|ltee)\.?\s*$/i, ""),
  );
}

async function findOrCreateEmployer(db: DB, name: string, isDemo: boolean, hint?: EmployerHint): Promise<string> {
  const aliasKey = normalizeEmployerName(name);
  const [byAlias] = await db
    .select({ id: employerAlias.employerId })
    .from(employerAlias)
    .where(eq(employerAlias.aliasNormalized, aliasKey))
    .limit(1);
  let employerId = byAlias?.id;

  if (!employerId) {
    const [created] = await db
      .insert(employer)
      .values({ slug: aliasKey, displayName: name, primaryDomain: hint?.domain ?? null, identityStatus: "UNKNOWN", isDemo })
      .onConflictDoUpdate({ target: employer.slug, set: { updatedAt: new Date() } })
      .returning({ id: employer.id });
    employerId = created!.id;
    await db.insert(employerAlias).values({ employerId, alias: name, aliasNormalized: aliasKey, isDemo }).onConflictDoNothing();
  }

  // Only an employer-owned source's configuration may attach domains. A
  // posting's own claims never do (that's how impersonation would get in).
  if (hint?.domain) {
    await db.update(employer).set({ primaryDomain: hint.domain }).where(eq(employer.id, employerId));
    await db.insert(employerDomain).values({ employerId, domain: hint.domain, kind: "PRIMARY", isDemo }).onConflictDoNothing();
    if (hint.careersUrl) {
      const careersHost = new URL(hint.careersUrl).hostname;
      await db.insert(employerDomain).values({ employerId, domain: careersHost, kind: "CAREERS", isDemo }).onConflictDoNothing();
    }
  }
  return employerId;
}

/** Per-posting: the employer behind this posting. Employer-owned sources use their configured employer. */
export async function resolveEmployer(db: DB, d: SourceDescriptor, posting: NormalizedPosting): Promise<string> {
  if (d.employerOwned && d.employerHint) return findOrCreateEmployer(db, d.employerHint.name, d.isDemo, d.employerHint);
  return findOrCreateEmployer(db, posting.employerName, d.isDemo);
}

const IDENTITY_RECHECK_MS = 24 * 60 * 60 * 1000;
const CONFIRMED_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Per-run, employer-owned sources only: link the source to its employer and
 * (re)establish identity from the careers-page probe.
 *
 *   CONFIRMED: a page on the employer's own domain links to this board.
 *   PROBABLE:  we ingest the employer's board but couldn't show the link.
 *   UNKNOWN:   no employer-owned source.
 *
 * Returns the employer id and whether identity status changed.
 */
export async function resolveSourceEmployer(
  db: DB,
  src: JobSource,
  sourceId: string,
  now: Date,
): Promise<{ employerId: string; identityChanged: boolean } | null> {
  const d = src.descriptor;
  if (!d.employerOwned || !d.employerHint) return null;
  const employerId = await findOrCreateEmployer(db, d.employerHint.name, d.isDemo, d.employerHint);
  await db.update(source).set({ employerId }).where(eq(source.id, sourceId));

  const [emp] = await db.select().from(employer).where(eq(employer.id, employerId));
  if (!emp) return null;
  const due = !emp.identityCheckedAt || now.getTime() - emp.identityCheckedAt.getTime() > IDENTITY_RECHECK_MS;
  if (!due || !src.probeIdentity) {
    if (emp.identityStatus === "UNKNOWN") {
      await db.update(employer).set({ identityStatus: "PROBABLE" }).where(eq(employer.id, employerId));
      return { employerId, identityChanged: true };
    }
    return { employerId, identityChanged: false };
  }

  const probe: IdentityProbe = await src.probeIdentity();
  const evidence: IdentityEvidence = {
    kind: "CAREERS_PAGE_LINKS_BOARD",
    text: probe.detail,
    url: probe.evidenceUrl,
    observedAt: probe.checkedAt.toISOString(),
  };
  let next = emp.identityStatus;
  let evidenceList = emp.identityEvidence;
  if (probe.linked === true) {
    next = "CONFIRMED";
    evidenceList = [evidence];
    if (probe.evidenceUrl) {
      await db
        .update(employerDomain)
        .set({ verifiedAt: probe.checkedAt, evidenceUrl: probe.evidenceUrl })
        .where(eq(employerDomain.employerId, employerId));
    }
  } else if (probe.linked === false) {
    next = "PROBABLE"; // the link we relied on is gone — downgrade
    evidenceList = [evidence];
  } else {
    // Couldn't check. Keep CONFIRMED only while the last proof is recent.
    const lastProof = emp.identityEvidence[0] ? new Date(emp.identityEvidence[0].observedAt) : null;
    const stillFresh = emp.identityStatus === "CONFIRMED" && lastProof && now.getTime() - lastProof.getTime() < CONFIRMED_GRACE_MS;
    next = stillFresh ? "CONFIRMED" : "PROBABLE";
    if (!stillFresh) evidenceList = [evidence];
  }
  await db
    .update(employer)
    .set({ identityStatus: next, identityEvidence: evidenceList, identityCheckedAt: now })
    .where(eq(employer.id, employerId));
  return { employerId, identityChanged: next !== emp.identityStatus };
}
