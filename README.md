# Provenant

**Before you apply, know what you're applying to.**

A job-seeker tool for Canada. Paste any job link or recruiter message and get a **Job Passport** showing where the job really came from, whether it's still listed, and what the salary evidence says. Every claim links to its evidence.

## Status
Phase 2 (foundation) is waiting on Checkpoint 2.

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
DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate   # once, for the test DB
npm test
```

## Layout
```
src/db/            Drizzle schema + client (migrations in drizzle/)
src/sources/       JobSource interface, demo + Greenhouse connectors, registry
src/pipeline/      run.ts (orchestrator, logging, retries), stages/*, worker.ts (pg-boss)
src/lib/           polite HTTP (robots.txt, rate limits), text utils, logging
src/app/           Next.js App Router (admin/jobs for now)
test/              Vitest unit + DB integration tests, fixtures
```

## Docs
- [PRD](docs/01-prd.md) · [User stories](docs/02-user-stories.md) · [Data model](docs/03-data-model.md)
- [Verification rule table](docs/04-verification-rules.md) · [Open questions and risks](docs/05-open-questions-and-risks.md)
- [Sources: terms and status](docs/sources.md)
