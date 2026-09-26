# Provenant

**Before you apply, know what you're applying to.**

A job-seeker tool for Canada. Paste any job link or recruiter message and get a **Job Passport** showing where the job really came from, whether it's still listed, and what the salary evidence says. Every claim links to its evidence.

## Status
Phase 5 (admin + hardening) is waiting on Checkpoint 5.

## Run locally
```bash
cp .env.example .env            # set ADMIN_DEV_OPEN=true to see /admin/jobs
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed                 # demo connector → full pipeline → 60 demo jobs
npm run dev                     # http://localhost:3000/admin/jobs
npm run worker                  # pg-boss worker, ingests all sources every 6h (INGEST_CRON)
npm run ingest [key-prefix]     # one-off ingest, e.g. `npm run ingest demo:`
npm run recheck                 # one-off freshness recheck + re-verify (worker does this hourly)
npm run make-admin -- you@example.com   # promote an existing user to ADMIN
DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate   # once, for the test DB
npm test
npm run test:e2e                # Playwright: the six §2 success steps end to end (migrates + reseeds first)
```

## Layout
```
src/db/            Drizzle schema + client (migrations in drizzle/)
src/sources/       JobSource interface, demo + Greenhouse connectors, registry
src/pipeline/      run.ts (orchestrator, logging, retries), stages/*, worker.ts (pg-boss)
src/verification/  rule-based signal engine — pure, structurally isolated from billing (see docs/04)
src/evidence/       salary/vacancy extraction, dedupe similarity, freshness, verify-job (DB bridge)
src/enrichment/     the one place AI is allowed (off by default; see docs/01 §"Where AI is allowed")
src/checker/        Check a Job: parse pasted text/URL, match against our index, verify
src/auth/           Better Auth server config, client, session helper
src/components/     Passport, job card, save/report/apply buttons, site header
src/lib/           polite HTTP (robots.txt, rate limits), crypto, email, analytics, logging
src/app/           Next.js App Router — landing, /check, /search, /jobs/[id], /saved,
                    /sign-in, /sign-up, /account, /admin/*, /docs/verification
test/              Vitest unit + DB integration tests, fixtures
```

## Docs
- [PRD](docs/01-prd.md) · [User stories](docs/02-user-stories.md) · [Data model](docs/03-data-model.md)
- [Verification rule table](docs/04-verification-rules.md) · [Open questions and risks](docs/05-open-questions-and-risks.md)
- [Sources: terms and status](docs/sources.md)

## User-facing pages
- `/` landing · `/check` Check a Job (URL or pasted text → Job Passport) · `/search` + `/jobs/[id]`
- `/sign-in` (password or magic link) · `/sign-up` · `/saved` (jobs + saved-search alerts) · `/account` (export/delete)
- `/dev/outbox` — magic links land here; no email provider is connected in this environment (dev-only page)

## Admin
Requires a signed-in user with role `ADMIN` (bootstrap one via `ADMIN_EMAILS` in `.env` before
sign-up, or `npm run make-admin -- you@example.com` after). `ADMIN_DEV_OPEN=true` also allows
access without signing in, but only outside a production build.

`/admin/jobs` (list) → `/admin/jobs/[id]` (full Job Passport + a staff override, R0, always
audited) · `/admin/review` (resolve duplicate clusters — merge or keep separate — and reports —
uphold or dismiss) · `/admin/sources` (source health, resolve dead-lettered errors) ·
`/admin/audit` (who did what, before/after, when) · `/docs/verification` (public "How
verification works", generated from the same rule catalog the code runs).
