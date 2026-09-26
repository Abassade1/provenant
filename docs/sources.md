# Sources: terms and status

Every source records *why* we may use it in `source.terms_reference` and `source.allowed_use`.

| Source | Type | Status | Terms | Notes |
|---|---|---|---|---|
| Demo boards (`demo:*`) | DEMO | ✅ Built | Our own fictional data | 8 fictional employers on `.example` domains, 60 jobs, all `is_demo` |
| Greenhouse Job Board API | ATS_PUBLIC_BOARD | ✅ Built, fixture-tested | https://developers.greenhouse.io/job-board.html | Public GET endpoints for an employer's own postings. **Open question:** permission for cross-employer aggregation. Not live-tested: this build environment's network blocks `boards-api.greenhouse.io`. |
| Lever Postings API | ATS_PUBLIC_BOARD | ⏳ Phase 3 | https://github.com/lever/postings-api | Second ATS connector |
| Ashby Job Posting API | ATS_PUBLIC_BOARD | ⏳ Later | https://developers.ashbyhq.com | |
| Job Bank (ESDC) | GOVERNMENT_OPEN_DATA | ⏳ Phase 3, fixture | Open Government Licence – Canada (to confirm per dataset) | Open-data extracts appear to be periodic, not live, so `checkLive` would be UNKNOWN. Needs confirmation. |

## Enabling Greenhouse boards
1. Add an entry to `src/sources/greenhouse/boards.json`:
   `{ "token": "<board token>", "employer": "<name>", "domain": "<employer domain>", "careersUrl": "<page on that domain linking to the board>" }`
2. Add the token to `GREENHOUSE_BOARDS` in `.env`.
3. Run `npm run ingest greenhouse:`.

The seed list of about 50 Canadian employers is **deliberately empty**. Each entry has to be checked by hand: the board exists, and the employer's own careers page links to it. That check couldn't be done from this environment, and we don't invent entries.

## Politeness
All network fetches go through `src/lib/http.ts`, which honours robots.txt (cached for 6 hours; a 5xx or unreachable robots.txt means "disallow"), applies the per-source `rate_limit_per_min`, sends an identifying User-Agent, and times out after 15 seconds.
