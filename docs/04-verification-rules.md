# Status rule table

**Implemented in Phase 3** at `src/verification/` — `catalog.ts` (this table and the signal
catalog, in plain language), `signals.ts` (computes signals), `status.ts` (applies the rule
table), `domains.ts` (ATS/lookalike-domain matching), `patterns.ts` (scam-text matching). The
module is pure (no I/O) and structurally isolated: `test/verification-isolation.test.ts` asserts
it imports nothing outside itself and never mentions billing/plan/sponsorship. The public
["How verification works"](../src/app/docs/verification/page.tsx) page renders straight from this
same catalog, so it can't drift from the code.

Statuses are derived from active signals by the **first matching rule**. Weights only order signals in the UI. They are never summed into a score or shown as a number.

"Scam-pattern" signals: `UPFRONT_PAYMENT_REQUEST`, `OFF_PLATFORM_CONTACT`, `LOOKALIKE_DOMAIN`, `APPLY_URL_MISMATCH`.

| # | Condition | Status |
|---|---|---|
| R0 | Active admin override | override value ("Reviewed by Provenant staff on {date}") |
| R1 | Every source record is confirmed gone by `checkLive`, or `expired_at` is set | `EXPIRED` |
| R2 | ≥ 2 scam-pattern signals | `HIGH_RISK` |
| R3 | 1 scam-pattern signal, or `USER_REPORTS`, or `SALARY_CONFLICT`, or an open duplicate cluster | `REVIEW_REQUIRED` |
| R4 | `STALE` (not confirmed live in > 14 days) | `STALE` |
| R5 | `ON_EMPLOYER_ATS` ∧ `EMPLOYER_IDENTITY_CONFIRMED` ∧ `RECENTLY_CONFIRMED_LIVE` ∧ no negatives | `VERIFIED` |
| R6 | (`ON_EMPLOYER_ATS` ∨ `EMPLOYER_IDENTITY_CONFIRMED`) ∧ no negatives other than neutral ones | `PARTIALLY_VERIFIED` |
| R7 | Otherwise (including `NOT_FOUND_ON_EMPLOYER_SITE`) | `UNVERIFIED` |

Demo jobs that reach R5 display as **"Verified (demo)"**.

## Plain-language status copy (draft, needs legal review)
- **Verified:** "We found this job on the employer's own hiring site and confirmed it was listed in the last 72 hours."
- **Partially verified:** "Some evidence checks out. See which parts we couldn't confirm."
- **Unverified:** "We couldn't confirm this job with the employer. That doesn't mean it's fake."
- **Stale:** "Not confirmed as listed in over 14 days. It may be closed."
- **Expired:** "The employer's listing has been removed."
- **Needs review:** "Something here needs a closer look. Here's what we found."
- **High risk:** "This posting shows N patterns common in job scams. Here's what we found."
