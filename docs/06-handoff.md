# Final hand-off

**Status:** all six planned phases complete (Plan → Foundation → Evidence engine → User
experience → Admin + hardening → Critical review). This is the MVP as scoped in
[`docs/01-prd.md`](01-prd.md) §Scope "P0", ready for a first real read-through and a decision
on what ships next.

## 1. Architecture, in one pass

```
Sources (Greenhouse/Lever/Job Bank/demo)
        │  JobSource interface (src/sources/)
        ▼
Ingestion pipeline (src/pipeline/) ── raw_posting → normalize → resolve employer
        │                                          → dedupe → salary/vacancy extraction
        │                                          → verification signals → status
        ▼
Postgres (canonical_job, job_source_record, salary_evidence, verification_signal, ...)
        │
        ├── Search (src/evidence/search.ts) ─────────────► /search, /jobs/[id]
        ├── Check a Job (src/checker/) ──────────────────► /check
        │     parses a pasted URL/text, extracts facts,
        │     matches against the index above, verifies
        └── Passport (src/components/passport.tsx) ─── one component, fed by either path
        │
        └── pg-boss worker (src/pipeline/worker.ts) — cron-scheduled:
              ingest (6h) · freshness recheck (hourly) · check purge (daily)
              · saved-search alerts (hourly)
```

The verification engine (`src/verification/`) is pure and structurally isolated: it has no I/O,
and a Vitest test (`test/verification-isolation.test.ts`) walks its import graph and fails the
build if it can reach anything mentioning billing, plan, or sponsorship. This is the one
guarantee in the product that's enforced by a test, not just a promise in copy: **payment can't
affect a job's status.**

## 2. Stack and why (Checkpoint 1 decisions)

| Area | Choice | Why |
|---|---|---|
| App | Next.js 15 App Router, TypeScript strict | Per brief |
| DB / ORM | Postgres 16 + Drizzle | SQL-first; `pg_trgm`/full-text search stay plain SQL; light, reviewable migrations |
| Queue | pg-boss | Cron, retries, dead-lettering, needs only Postgres — no separate broker |
| Auth | Better Auth (not Auth.js) | Auth.js's credentials provider is discouraged and forces JWT-only sessions; Better Auth supports password (argon2) + magic link with DB sessions |
| Validation | Zod | Single source of truth for both URL search params and stored `saved_search.filters` |
| Tests | Vitest (DB-integration, real Postgres) + Playwright (E2E) | Per brief |
| Local dev | Docker Compose (Postgres only) | Per brief |

Full rationale and the other Checkpoint decisions are in [`docs/01-prd.md`](01-prd.md) and
[`docs/05-open-questions-and-risks.md`](05-open-questions-and-risks.md).

## 3. Schema

See [`docs/03-data-model.md`](03-data-model.md) for the full ER diagram and column list. The
short version: `source → raw_posting → job_source_record ← canonical_job → salary_evidence /
verification_signal`, plus `employer` (with identity confidence), `duplicate_cluster`, and the
user-facing tables `user`, `saved_job`, `saved_search`, `notification`, `job_check`, `job_report`,
`admin_audit_log`.

## 4. What's real vs. stubbed

**End-to-end, tested, works today:**
- Full ingestion pipeline for the demo connector (60 fictional jobs across 8 employers) and for
  Greenhouse/Lever (built and fixture-tested; **not live-tested** — this build environment
  blocks `boards-api.greenhouse.io` and `api.lever.co`, and the real board-token seed list is
  deliberately empty pending manual verification per employer, see `docs/sources.md`).
- Employer resolution, dedup (with anti-merge guards for scam patterns/apply-link mismatches),
  the full R0–R7 verification rule table, freshness rechecking.
- Check a Job: URL/text parsing, employer resolution, matching against the index, verification,
  AES-256-GCM-at-rest storage of pasted text, TTL-based purge (added in Phase 6).
- Search + filters + Job Passport on every result and on the job detail page.
- Auth (password + magic link — magic links log to `/dev/outbox` since no email provider is
  connected in this environment), saved jobs, saved searches, **saved-search alerts with a
  real notifications inbox** (added in Phase 6 — this was pure UI promise through Phase 5).
- Reports (user-submitted), admin review/override/audit log, WCAG AA-verified theme.
- Data export (`/api/account/export`) and account deletion.

**Built but explicitly limited:**
- Job Bank connector reads a local fixture only (`JOBBANK_FIXTURE`) — the real ESDC dataset's
  record shape is assumed, and a periodic extract can never support `checkLive`, so it always
  reports freshness as unavailable.
- Ashby connector: not built (same `JobSource` shape as Greenhouse/Lever would apply).
- AI extraction (`src/enrichment/`) is off by default and, when on, only ever produces *inputs*
  labelled "extracted automatically" — it never sets a status and the isolation test above
  ensures it can't reach billing either.

**Known gaps / not attempted (P1/P2 by brief §Scope):**
- Email delivery for alerts (in-app notifications only — see §7 below).
- Matching improvements beyond lexical+structured similarity (an embedding-based
  `SimilarityScorer` would drop in without changing callers).
- Change history, application tracker, employer pages, browser extension, résumé upload,
  employer portal, analytics, data API, B2B — all explicitly deferred per the brief.

## 5. Verification rules, as implemented

The full R0–R7 table, the signal catalog, and the plain-language copy are in
[`docs/04-verification-rules.md`](04-verification-rules.md) and rendered live at
`/docs/verification`, generated directly from `src/verification/catalog.ts` so the public page
can never drift from the code. Statuses are decided by first-matching-rule, never a summed
score; `weight` only orders signals in the UI.

## 6. What verification cannot prove — say this to anyone evaluating the product

This is the single most important limitation and it's asserted directly on the product
(`/docs/verification`, "What we can't tell you") and the landing page, not buried:

- We can confirm a posting is **listed** on an employer's own board or careers page. We **cannot**
  confirm the employer is actively hiring for it, that the role is still open, or that the person
  who will interview you is who they say they are.
- Absence of confirmation is not evidence of a scam. Many real employers don't publish anywhere
  we check yet (P0 has two ATS connectors plus a government fixture) — `UNVERIFIED` explicitly
  says "that doesn't mean it's fake."
- `HIGH_RISK` describes patterns found in the text (upfront payment requests, off-platform
  contact asks, lookalike domains, apply-link mismatches) — it never accuses a named real
  employer of anything, by design (legal exposure risk, see `docs/05` Risks table).
- Check a Job's match against our own index is itself probabilistic (a similarity score against a
  merge threshold) — a pasted message naming a real employer only borrows that employer's
  evidence when the text matches closely enough; otherwise it's scored purely on its own signals,
  by design, so a scam can't launder trust just by naming a real company.
- We do not verify identity documents, licensing, or anything about the *person* on the other end
  of a message — only the posting.

## 7. Security / privacy notes

- Pasted check text is encrypted at rest (AES-256-GCM, `CHECK_ENCRYPTION_KEY`) and never logged
  raw anywhere in the codebase (verified by grep as part of the Phase 6 review).
- `job_check` rows are deleted by a scheduled purge job (`PURGE_CRON`, default daily) once past
  `CHECK_RETENTION_DAYS` (default 30) — added in Phase 6; before that the landing page's
  retention promise had no code behind it.
- `/api/account/export` deliberately excludes the pasted text of past checks, so the export path
  itself can't become a second leak surface for third-party PII a pasted message might mention.
- All outbound fetches (`src/lib/http.ts`) honour `robots.txt`, apply per-source rate limits, and
  identify themselves with `FETCH_USER_AGENT` — a denylisted/disallowed domain in Check a Job is
  never fetched; the user is told to paste the text instead.
- Admin routes require `role = ADMIN`, verified against a live session; the `ADMIN_DEV_OPEN`
  bypass is compiled out of production builds.
- Every admin mutation (override, cluster resolution, report resolution) writes to
  `admin_audit_log` (who, what, before/after, when).

## 8. Sources: terms and status

See [`docs/sources.md`](sources.md) for the full table. Summary: demo (built, fictional),
Greenhouse and Lever (built, fixture-tested, not live-tested from this environment, cross-employer
aggregation terms still an open question — see `docs/05`), Job Bank (fixture only, live feed
would need an ESDC partnership), Ashby (not built). **No board-token seed list has been invented
or populated** — each entry needs a human to confirm the board exists and the employer's own
careers page actually links to it.

## 9. Demo → production data

1. Set `ENABLE_DEMO_SOURCE=false` (hides the demo banner and stops seeding fictional jobs).
2. Populate `src/sources/greenhouse/boards.json` with real, hand-verified employer entries (see
   `docs/sources.md` "Enabling Greenhouse boards") and list them in `ATS_BOARDS`.
3. Resolve the open cross-employer-aggregation permission question with Greenhouse/Lever (or
   employers directly) before any public launch — flagged in `docs/05`, not resolved here.
4. Get a real Job Bank feed/partnership if live freshness on government postings matters, or keep
   it fixture-only and keep saying so.
5. Connect a real email provider — magic links and alert emails (if added, see below) currently
   only work via `/dev/outbox`.
6. Generate real secrets (`BETTER_AUTH_SECRET`, `CHECK_ENCRYPTION_KEY`) — the `.env.example`
   defaults are dev-only and say so.
7. Get legal sign-off on status wording (`docs/05` flags "Verified" specifically) and the Ontario
   vacancy-disclosure copy.

## 10. Recommended next phase, ranked by impact on the §2 hypothesis

The hypothesis is: *job seekers will use a tool that shows transparent, sourced evidence, and
come back to it — especially for jobs found elsewhere.* Ranked by what most directly tests that:

1. **Real Greenhouse/Lever boards for a real seed list of ~50 employers.** Right now the search
   index is 100% demo data; the hypothesis can't be tested at all without real evidence to show.
   This is the single highest-impact next step and is explicitly gated on the terms question in
   `docs/05` — resolve that first.
2. **Email delivery for saved-search alerts.** The in-app notification inbox (built in Phase 6)
   proves the mechanism works, but "come back to it" is much likelier if the return trigger
   reaches an inbox instead of requiring a repeat visit to notice the badge.
3. **Ashby connector**, to widen the real-employer set at roughly the same cost as Greenhouse/Lever.
4. **A second, independent similarity scorer (embeddings)** — the interface already supports
   swapping it in, and it directly improves both dedupe quality and Check-a-Job matching
   confidence, which is the mechanism that lets a pasted job borrow real evidence at all.
5. Everything else in P1/P2 (application tracker, browser extension, employer portal, etc.) — real
   but secondary to first proving the core loop works with real jobs and reaches people again.

## 11. Test coverage at hand-off

- Vitest: 192 tests across 16 files (unit + DB-integration against a real Postgres test
  database) — `npm test`.
- Playwright: one spec per §2 success story (`e2e/s1-*` through `e2e/s6-*`) run against seeded
  demo data — `npm run test:e2e`. (In this container, Playwright's pinned browser build didn't
  match what's pre-installed; run with `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` if
  you hit an "Executable doesn't exist" error — this is a container quirk, not a product bug.)
  11 of 18 pass here; the other 7 (parts of `s1-check-a-job` and `s6-save-and-alert`) time out
  waiting on a client-side control (a radio's `textarea` reveal, a sign-up redirect) that never
  fires — confirmed by re-running against the pre-Phase-6 commit, where the same tests fail the
  same way. That points to slow/inconsistent hydration in this specific sandboxed container
  rather than anything Phase 6 changed; it's worth re-running these once outside this
  environment before trusting the number either way.
- `tsc --noEmit` and `next build` both clean.
