import { SIGNALS, THRESHOLDS } from "./catalog";
import { hostnameOf, isEmployerDomain, isKnownAts, isKnownPublicBoard, lookalikeOf } from "./domains";
import { findOffPlatformContact, findUpfrontPayment } from "./patterns";
import type { SalaryInput, Signal, SignalCode, VerificationInput } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function sig(code: SignalCode, evidenceText: string, observedAt: Date, extra: Partial<Signal> = {}): Signal {
  const def = SIGNALS[code];
  return {
    code,
    polarity: def.polarity === "POSITIVE_OR_NEUTRAL" ? "POSITIVE" : def.polarity,
    weight: def.weight,
    evidenceText,
    observedAt,
    ...extra,
  };
}

function relative(now: Date, then: Date): string {
  const h = Math.round((now.getTime() - then.getTime()) / HOUR);
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

const HOURS_PER: Record<string, number> = { HOUR: 1, DAY: 8, WEEK: 40, MONTH: 2080 / 12, YEAR: 2080 };

/** Annualized [min, max] so ranges stated per hour and per year can be compared. */
export function annualRange(s: SalaryInput): [number, number] | null {
  if (!s.period || (s.min == null && s.max == null)) return null;
  const k = 2080 / HOURS_PER[s.period]!;
  const lo = (s.min ?? s.max)! * k;
  const hi = (s.max ?? s.min)! * k;
  return [lo, hi];
}

export function salariesConflict(a: SalaryInput, b: SalaryInput, tolerance: number = THRESHOLDS.salaryTolerance): boolean {
  if (a.currency !== b.currency) return false; // can't compare without FX; not a conflict
  const ra = annualRange(a);
  const rb = annualRange(b);
  if (!ra || !rb) return false;
  // Conflict when the ranges don't overlap even after widening each by the tolerance.
  return ra[1] * (1 + tolerance) < rb[0] * (1 - tolerance) || rb[1] * (1 + tolerance) < ra[0] * (1 - tolerance);
}

export function computeSignals(input: VerificationInput): Signal[] {
  const { now, job, employer } = input;
  const out: Signal[] = [];
  const active = input.sources.filter((s) => !s.expiredAt);
  const employerOwned = active.filter((s) => s.employerOwned);

  // ── Employer board / identity ─────────────────────────────────────────
  if (employerOwned[0]) {
    out.push(
      sig("ON_EMPLOYER_ATS", `Listed on ${employerOwned[0].sourceName}.`, employerOwned[0].lastVerifiedAt ?? now, {
        evidenceUrl: employerOwned[0].url,
        sourceId: employerOwned[0].sourceId,
      }),
    );
  } else if (employer?.hasEmployerBoard && employer.employerBoardCheckedAt) {
    out.push(
      sig(
        "NOT_FOUND_ON_EMPLOYER_SITE",
        `We checked ${employer.name}'s own job board ${relative(now, employer.employerBoardCheckedAt)} and this posting wasn't there.`,
        employer.employerBoardCheckedAt,
      ),
    );
  }

  // Identity only vouches for *this posting* when the posting is tied to the
  // employer's own channel — otherwise an impersonator would inherit it.
  const applyHostForIdentity = hostnameOf(job.applyUrl);
  const tiedToEmployer =
    employerOwned.length > 0 || (!!applyHostForIdentity && isEmployerDomain(applyHostForIdentity, employer?.domains ?? []));
  if (employer?.identityStatus === "CONFIRMED" && tiedToEmployer) {
    const ev = employer.identityEvidence[0];
    out.push(
      sig("EMPLOYER_IDENTITY_CONFIRMED", ev?.text ?? `${employer.name}'s website links to this job board.`, ev ? new Date(ev.observedAt) : now, {
        evidenceUrl: ev?.url,
      }),
    );
  }

  // ── Apply link ────────────────────────────────────────────────────────
  const applyHost = hostnameOf(job.applyUrl);
  if (applyHost) {
    const employerDomains = employer?.domains ?? [];
    const imitated = lookalikeOf(applyHost, input.knownEmployerDomains);
    if (imitated) {
      out.push(sig("LOOKALIKE_DOMAIN", `The link goes to ${applyHost}, which looks like ${imitated} but isn't it.`, now, { evidenceUrl: job.applyUrl ?? undefined }));
    } else if (isEmployerDomain(applyHost, employerDomains)) {
      out.push(sig("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", `The apply link goes to ${applyHost}, the employer's own domain.`, now, { evidenceUrl: job.applyUrl ?? undefined }));
    } else if (isKnownAts(applyHost)) {
      out.push(sig("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", `The apply link goes to ${applyHost}, a hiring system employers commonly use.`, now, { evidenceUrl: job.applyUrl ?? undefined }));
    } else if (isKnownPublicBoard(applyHost)) {
      out.push(sig("APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS", `The apply link goes to ${applyHost}, a government job board.`, now, { evidenceUrl: job.applyUrl ?? undefined }));
    } else if (employerDomains.length > 0) {
      out.push(
        sig("APPLY_URL_MISMATCH", `The apply link goes to ${applyHost}, which isn't one of ${employer!.name}'s domains (${employerDomains.join(", ")}) or a hiring system we recognize.`, now, {
          evidenceUrl: job.applyUrl ?? undefined,
        }),
      );
    }
  }

  // ── Text patterns ─────────────────────────────────────────────────────
  const offPlatform = findOffPlatformContact(job.text);
  if (offPlatform.length) out.push(sig("OFF_PLATFORM_CONTACT", `“${offPlatform[0]!.sentence}”`, now));
  const payment = findUpfrontPayment(job.text);
  if (payment.length) out.push(sig("UPFRONT_PAYMENT_REQUEST", `“${payment[0]!.sentence}”`, now));

  // ── Freshness ─────────────────────────────────────────────────────────
  const lastVerified = job.lastVerifiedAt;
  if (lastVerified && now.getTime() - lastVerified.getTime() <= THRESHOLDS.recentlyConfirmedHours * HOUR) {
    out.push(sig("RECENTLY_CONFIRMED_LIVE", `Last confirmed listed ${relative(now, lastVerified)}.`, lastVerified));
  }
  const freshnessAnchor = lastVerified ?? job.firstSeenAt;
  if (!job.expiredAt && now.getTime() - freshnessAnchor.getTime() > THRESHOLDS.staleDays * DAY) {
    out.push(
      sig(
        "STALE",
        lastVerified
          ? `Last confirmed listed ${relative(now, lastVerified)}.`
          : `First seen ${relative(now, job.firstSeenAt)} and never confirmed on the employer's own board.`,
        now,
      ),
    );
  }

  // ── Salary ────────────────────────────────────────────────────────────
  const stated = input.salaries.filter((s) => s.type === "EMPLOYER_STATED");
  const hosted = stated.find((s) => s.employerHosted);
  if (hosted) {
    out.push(sig("SALARY_STATED_BY_EMPLOYER", `“${hosted.evidenceText}”`, now, { sourceId: hosted.sourceId ?? undefined }));
  }
  let conflict = false;
  for (let i = 0; i < stated.length && !conflict; i++) {
    for (let j = i + 1; j < stated.length; j++) {
      if (stated[i]!.sourceId !== stated[j]!.sourceId && salariesConflict(stated[i]!, stated[j]!)) {
        out.push(sig("SALARY_CONFLICT", `One source says “${stated[i]!.evidenceText}”; another says “${stated[j]!.evidenceText}”.`, now));
        conflict = true;
        break;
      }
    }
  }

  // ── Vacancy statement ─────────────────────────────────────────────────
  if (job.vacancyStatement) {
    const notExisting = /\bnot\b.{0,20}\bexisting vacancy\b|\bpool\b|\bfuture (openings|opportunities|vacancies)\b|\bn['’]est pas\b.{0,30}\bvacant\b/i.test(job.vacancyStatement);
    const s = sig("VACANCY_STATUS_DISCLOSED", `“${job.vacancyStatement}”`, now);
    if (notExisting) s.polarity = "NEUTRAL";
    out.push(s);
  }

  // ── Cross-source consistency ──────────────────────────────────────────
  if (active.length >= 2 && !conflict) {
    const stems = new Set(active.map((s) => s.titleStem));
    const locs = new Set(active.map((s) => s.locationKey));
    if (stems.size === 1 && locs.size === 1) {
      out.push(sig("CONSISTENT_ACROSS_SOURCES", `Title and location match across ${active.length} sources.`, now));
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────
  if (input.pendingReporters >= THRESHOLDS.reportersForSignal) {
    out.push(sig("USER_REPORTS", `${input.pendingReporters} people reported this job. Their reports are waiting for staff review.`, now));
  }

  return out.sort((a, b) => b.weight - a.weight);
}
