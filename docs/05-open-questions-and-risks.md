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
