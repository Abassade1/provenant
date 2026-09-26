# Open questions, risks and brief conflicts

## Conflicts in the brief (need your call)
1. **"Paste a job URL from any site" (§1, §12) vs "no scraping LinkedIn/Indeed/Glassdoor" (§3).** *Proposal:* keep a domain denylist. For those domains we never fetch and ask the user to paste the text instead. We don't fetch the page on the user's behalf either, because it's still an automated fetch from our servers.
2. **Auth.js "magic link + password" (§4).** Auth.js's credentials provider is officially discouraged and doesn't work with database sessions. *Proposal:* use Better Auth with argon2 (see PRD). The alternative is Auth.js with magic link only, dropping passwords from the MVP.
3. **"< 10 s" (§2) vs live employer resolution for unknown employers (§12).** Finding an unknown employer's ATS board means probing multiple providers and careers pages. *Proposal:* 10 s p95 for known employers. For unknown ones, stream a partial Passport and finish within 30 s.
4. **`weight` in the signal model (§7) vs "no opaque score".** *Proposal:* weight only orders signals in the UI. It's never summed or shown.
5. **`USER_REPORTS` as a negative signal.** Competitors or angry ex-applicants could weaponize it. *Proposal:* reports can only trigger `REVIEW_REQUIRED` (R3), never `HIGH_RISK`, and N defaults to 3 distinct accounts.
6. **"Last confirmed" copy.** §9's example says "9 days ago, may be closed", and STALE starts at 14 days. *Proposal:* show a "may be closed" hint after 7 days and switch the status to `STALE` at 14 days.

## Open questions
- **Greenhouse / Lever / Ashby terms.** All three expose public job-board endpoints meant for employers to embed their own jobs. I'll record the exact terms URLs in `source.terms_reference` in Phase 2. **Aggregating across employers may need explicit permission.** Decide whether we contact the providers or employers before any public launch.
- **Job Bank.** The Open Government Portal publishes Job Bank datasets under the Open Government Licence – Canada, but as I understand it they're **periodic historical extracts, not a live feed**, so they can't support `checkLive`. I'll confirm in Phase 2. If there's no live feed, the connector runs against a fixture and is marked "freshness unavailable". A live feed may need an ESDC partnership.
- **Ontario vacancy disclosure.** The *Working for Workers Five Act, 2024* amendments (in force Jan 1, 2026) require disclosing whether a publicly advertised job is an existing vacancy, for employers with 25+ employees. We quote the statement verbatim and don't judge compliance. **Legal should confirm our copy.**
- **Status names.** Is "Verified" defensible wording under the Competition Act (misleading representations)? Alternative: "Confirmed with employer". Needs legal review before launch.
- **Seed list.** Which ~50 Canadian employers use Greenhouse, Lever or Ashby? I'll assemble a candidate list from public boards in Phase 2 for you to approve. No list gets invented.
- **Check retention period.** Default proposal: 30 days, configurable.

## Risks
| Risk | Mitigation |
|---|---|
| Legal exposure from a HIGH_RISK label on a real employer | Pattern-only copy, no accusations, staff review path, audit log |
| ATS providers block or rate-limit us | Per-source rate limits, backoff, respect robots.txt, seek agreements |
| False VERIFIED on a hijacked ATS board or a compromised careers page | Require the domain → board link for CONFIRMED identity, and re-check identity periodically |
| Pasted texts contain third-party PII | Encrypt at rest, no raw-text logging, TTL deletion |
| Thin index (50 employers) makes Search feel empty | Lead with Check a Job, keep the demo banner honest |
| Scope creep | Anything that doesn't help decide "real, current, worth applying" is deferred |

## Phase 4 additions and decisions
- **Auth:** Better Auth (email + password with argon2, plus magic link), per the Checkpoint 1 decision. No email provider is connected in this environment; magic links and other outbound mail log to `/dev/outbox` (dev-only, 404s in production) instead of being delivered.
- **`analytics_event` table:** not in the original §15 list. Added because §18 requires tracking `check_submitted`, `passport_expanded`, `search_performed`, `apply_clicked`, `job_saved`, `alert_created`, `report_submitted`, and nothing else in the schema holds them.
- **Check a Job matching:** rather than a live synchronous fetch of the employer's ATS board on every check (which risks blowing the 10s target and duplicates the ingestion pipeline), a check is matched against our own continuously-refreshed index — the same data ingestion already keeps current from the employer's own board. A match only lends its freshness/identity signals to the check when the similarity score clears the same merge threshold dedupe uses; below that, the check is scored purely on its own text so a scam message can never borrow a real employer's trust just by naming them.
- **Similarity scoring for short pastes:** the dedupe scorer compares two full postings and leans on description-text overlap. A short pasted paraphrase will never score well on text alone against a full listing, so the checker adds a structured score (exact title + location + salary agreement) and takes the max of the two — see `src/checker/match.ts`.
- **`/api/account/export` (§16):** exports profile, saved jobs, saved searches, notifications, and check metadata. It deliberately excludes the pasted text of past checks (encrypted at rest, never decrypted for export in this phase) to keep the export itself from becoming a second place third-party PII could leak.

## Phase 5 additions and decisions
- **Real admin authorization.** Admin routes now require a signed-in user with `role = ADMIN`
  (`src/lib/admin-guard.ts`), verified live: a bootstrap admin (via `ADMIN_EMAILS`) gets in, a
  regular signed-up user gets a 404. The Phase 2 `ADMIN_DEV_OPEN` bypass still works for local
  iteration but only outside a production build.
- **Admin actions + audit log.** Staff overrides (R0), duplicate-cluster resolution (merge / keep
  separate), report resolution (uphold / dismiss), and dead-lettered-error resolution are all
  live, each writing to `admin_audit_log` (who, what, before, after, when) and re-running
  verification on any job the action touches. `revalidatePath` is wrapped defensively — it needs
  a Next.js request-scoped store that doesn't exist when an action is invoked directly (e.g. in a
  test), and a cache-invalidation hint failing should never break the actual mutation.
- **Playwright E2E for the six success steps** (`e2e/`, `npm run test:e2e`) — one spec per step
  in `docs/02-user-stories.md`, run against the seeded demo data. This surfaced two real bugs,
  not just test-authoring issues:
  1. The job detail page's "already saved" check was missing its `userId` filter, so any
     signed-in user saw a job as saved if *any* user had ever saved it. Fixed in
     `src/app/jobs/[id]/page.tsx`.
  2. `SaveSearchForm` set the success notice and collapsed the form in the same state update, so
     the confirmation text was thrown away in the render it appeared in and never actually
     painted. Fixed by keeping a `saved` state that renders the notice outside the collapsible
     form instead of inside it.
  Also fixed the "jobs without a salary sort last" note, which was gated on `salaryMin` being set
  instead of on `sort === "salary"` as the copy claims.
- **Accessibility pass:** all theme color pairs already clear WCAG AA (verified: text ≥ 6.5:1,
  UI/large text ≥ 7:1 in both themes); added a skip-to-content link, labelled the two previously
  placeholder-only Check a Job inputs and the report textarea, and promoted the Job Passport's
  section title to a real heading so it appears in heading-based navigation.

## Phase 6: critical review (walked the product as a skeptical job seeker)
Found and fixed several places the UI claimed more than the evidence backed, and two
promised features with no backend behind them at all:
- **Salary provenance mislabeled.** Check-a-Job's Passport showed a salary as
  employer-confirmed (`derived: boolean` only distinguished "employer" vs "estimated") even
  when it came from AI extraction or straight from the pasted text with no match at all.
  `PassportSalary` now carries `provenance: "employer" | "extracted" | "pasted"` and the
  Passport renders the honest label for each, including "from the text you pasted — not
  confirmed by the employer" for the pasted case.
- **"Also found on" conflated 0 and 1 sources.** The Passport's source count line read the
  same whether we'd matched nothing or matched exactly one source. Now distinguishes "we
  haven't matched this to anything in our index" from "this is the only source we found"
  from "N sources."
- **Check-a-Job discarded real evidence on a strong match.** Even when a pasted job matched
  an indexed posting closely enough to be treated as the same job, the Passport showed no
  sources and no salary — `findMatchingJob` computed the match but the UI never surfaced its
  `displaySources`/`displaySalaries`. Fixed by threading them through `CheckOutcome` and
  rendering them whenever `isStrongMatch` is true.
- **Retention promise had no purge job.** The landing page has always promised checks are
  "deleted after a limited retention period," but nothing ever deleted a `jobCheck` row.
  Added `purgeExpiredChecks` (`src/checker/purge.ts`), a worker schedule (`PURGE_CRON`,
  default daily at 4am), and a standalone `npm run purge-checks` script.
- **Saved-search alerts were pure UI, no backend.** "You'll get an alert when new matches
  appear" has been in the copy since Phase 4 with nothing behind it — confirmed via a full
  grep for `lastNotifiedAt`/`notification` outside the schema. Built the whole feature:
  `generateSavedSearchAlerts` (`src/evidence/alerts.ts`) diffs each saved search against jobs
  first seen since its last check (or its creation, on the first run) and writes a
  notification per match; a worker schedule (`ALERTS_CRON`, default hourly) and a manual
  `npm run generate-alerts` script drive it; a `/notifications` page, header unread-count
  badge, and mark-read/mark-all-read actions give users somewhere to actually see the result
  — there was previously no UI for notifications at all, so `job_saved`-adjacent alerts were
  invisible even if they'd existed.
- **`/saved` could crash on a stale saved search.** It parsed each saved search's stored
  filters with `.parse` (throws on failure) while `alerts.ts` correctly used `.safeParse` for
  the same data — a filters shape that no longer validates (schema changed, corrupted JSON)
  would 500 the whole page instead of just that one row. Now uses `.safeParse` and shows
  "filters no longer valid — delete and re-save" for the broken entry only.

Verified after these fixes: full Vitest suite 192/192 passing (16 files, including new
`test/purge.test.ts` and `test/alerts.test.ts`), `tsc --noEmit` clean, `next build` clean.
