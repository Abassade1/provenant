# Provenant — One-page PRD

**Positioning:** Before you apply, know what you're applying to.

## Problem
Job seekers in Canada can't tell if a posting is real, still open, or honest about pay. Postings go stale, show up many times across sites, and a growing share of scams never touch a job board: they arrive by SMS, WhatsApp, social DMs and email. Freshness tools such as HiringCafe already index career pages, so freshness alone is table stakes.

## Product
Two entry points share one **evidence engine** and one **Job Passport**:

1. **Check a Job (the wedge).** The user pastes a URL or text. We extract the facts, resolve the employer, look for the same role on the employer's own ATS or careers page, run the verification rules and return a Passport.
2. **Search verified jobs.** An index built only from permitted sources: employer ATS boards, government open data and employer submissions. Every result carries a Passport.

**Moat:** evidence that explains itself, plus the ability to check jobs we never indexed.

## Hypothesis
Job seekers will use a tool that shows transparent, sourced evidence about legitimacy, freshness and salary, and come back to it, especially for jobs they found elsewhere.

## MVP success test (§2)
A first-time user, without help, can:
1. Get a Passport for a pasted URL or text in < 10 s.
2. Understand *why* a job got its status, with every signal expandable to its evidence.
3. Search and filter by location, salary, remote type and freshness.
4. Open a job and see its original source, salary provenance and duplicate sources.
5. Click **Apply at original source** and land on the employer's real application page.
6. Save a job and create a saved-search alert.

## Principles (enforced in code, not just copy)
- There is no single opaque score. Status comes from a published rule table, and every signal carries its evidence.
- The UI never says "scam" and never accuses a named real employer. HIGH_RISK lists the specific patterns found.
- Payment never affects verification. The verification module can't read monetization fields, and a test asserts this.
- AI only produces *inputs* such as extracted fields, labelled "extracted automatically". It never sets a status. The system runs with AI off.
- Every demo record is flagged, shown behind a persistent banner, and never uses a real employer's identity.
- We claim only what we can prove: that a posting is *listed*, not that the employer is *actively hiring*.

## Scope
**P0:** sources (2 ATS connectors, Job Bank or fixture, demo), pipeline, normalization, employer resolution, dedupe, verification, freshness rechecks, employer-stated salary, Passport, Check a Job, search/detail, auth, saved jobs, in-app alerts, reports, minimal admin.
**P1:** matching, email alerts, change history, application tracker, employer pages, browser extension, résumé upload.
**P2:** employer portal, analytics, data API, B2B.
**Never:** scraping sites whose terms forbid it, auto-apply, chatbots, gamification, paid placement that touches trust.

## Stack decisions (Checkpoint 1)
| Area | Choice | Reason |
|---|---|---|
| App | Next.js App Router, TS strict | Per brief |
| DB / ORM | Postgres 16 + **Drizzle** | SQL-first, `pg_trgm`/FTS stay plain SQL, light migrations |
| Queue | **pg-boss** | Cron, retries and dead-letter built in, needs only Postgres |
| Auth | **Better Auth** instead of Auth.js ⚠️ | Auth.js's credentials provider is discouraged and forces JWT sessions. Better Auth supports password + magic link with DB sessions, and we plug in argon2 (`@node-rs/argon2`). *Needs your OK.* |
| UI | Tailwind + Radix primitives | Per brief |
| Validation | Zod | Per brief |
| Tests | Vitest + Playwright | Per brief |
| Local | Docker Compose (Postgres) | Per brief |

## Metrics (events only, no invented numbers)
`check_submitted`, `passport_expanded`, `search_performed`, `apply_clicked`, `job_saved`, `alert_created`, `report_submitted`. Pipeline health: jobs ingested, % confirmed live in the last 72 h, dedupe rate, salary disclosure rate, ingestion error rate.
