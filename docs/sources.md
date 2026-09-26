# Sources: terms and status

Every source records *why* we may use it in `source.terms_reference` and `source.allowed_use`.

| Source | Type | Status | Terms | Notes |
|---|---|---|---|---|
| Demo boards (`demo:*`) | DEMO | ✅ Built | Our own fictional data | 8 fictional employers on `.example` domains, 60 jobs, all `is_demo` |
| Greenhouse Job Board API | ATS_PUBLIC_BOARD | ✅ Built, fixture-tested | https://developers.greenhouse.io/job-board.html | Public GET endpoints for an employer's own postings. **Open question:** permission for cross-employer aggregation. Not live-tested: this build environment's network blocks `boards-api.greenhouse.io`. |
| Lever Postings API | ATS_PUBLIC_BOARD | ✅ Built, fixture-tested | https://github.com/lever/postings-api | Same terms question as Greenhouse. Not live-tested: `api.lever.co` is blocked here too. |
| Ashby Job Posting API | ATS_PUBLIC_BOARD | ⏳ Later | https://developers.ashbyhq.com | Not built — would follow the same `JobSource` shape as Greenhouse/Lever. |
| Job Bank (ESDC) | GOVERNMENT_OPEN_DATA | ✅ Built, fixture only | Open Government Licence – Canada (to confirm per dataset) | `JobBankSource` reads a local JSON file (`JOBBANK_FIXTURE`); it never fetches. The record shape in `src/sources/jobbank/index.ts` is **assumed**, pending the real dataset. `checkLive` always returns UNKNOWN — a periodic extract can't confirm a posting is still listed. |

## Enabling Greenhouse boards
1. Add an entry to `src/sources/greenhouse/boards.json`:
   `{ "token": "<board token>", "employer": "<name>", "domain": "<employer domain>", "careersUrl": "<page on that domain linking to the board>" }`
2. Add the token to `GREENHOUSE_BOARDS` in `.env`.
3. Run `npm run ingest greenhouse:`.

The seed list of about 50 Canadian employers is **deliberately empty**. Each entry has to be checked by hand: the board exists, and the employer's own careers page links to it. That check couldn't be done from this environment, and we don't invent entries.

## Employer identity (CONFIRMED / PROBABLE / UNKNOWN)
For an employer-owned ATS source (`boards.json` entry with a `careersUrl`), the pipeline fetches
that careers page once a day and checks that it links to the board (`JobSource.probeIdentity`).
A link found → `CONFIRMED`. No link, or no `careersUrl` configured → `PROBABLE`. A `CONFIRMED`
status survives a single failed check for 30 days (the page might be briefly down) before
downgrading. Demo employers without `careersLinksBoard` in `src/sources/demo/data.ts` show this
honestly as `PROBABLE`.

## Deduplication
`src/pipeline/stages/deduplicate.ts` blocks candidates by employer + title stem + city (or remote
type when there's no city), then scores pairs with `src/evidence/dedupe/similarity.ts` (title,
description shingles, location, salary overlap, skills, shared URL — the interface `SimilarityScorer`
is model-agnostic, so an embedding scorer can replace it later). ≥ 0.85 merges into one canonical
job; 0.6–0.85 opens a `REVIEW_REQUIRED` duplicate cluster; below that, jobs stay separate. Extra
guards (`deduplicate.ts`) stop an auto-merge even at high similarity when the apply link doesn't
match the employer/a known ATS, or the incoming text shows a scam pattern — those always go to
review instead, however similar the text.

## Freshness
`src/evidence/freshness.ts` rechecks every active source record with `JobSource.checkLive`: every
12h if the posting is under 7 days old, daily after that. A posting missing from an employer-owned
board's latest full fetch is explicitly rechecked (never assumed gone). Freshness rolls up to the
canonical job as `last_verified_at` = latest confirmation across sources, `expired_at` set only
once every source record has expired.

## Politeness
All network fetches go through `src/lib/http.ts`, which honours robots.txt (cached for 6 hours; a 5xx or unreachable robots.txt means "disallow"), applies the per-source `rate_limit_per_min`, sends an identifying User-Agent, and times out after 15 seconds.
