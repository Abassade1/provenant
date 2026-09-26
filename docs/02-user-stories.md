# User stories: the six success steps

Each story maps to a §2 success step and becomes a Playwright journey in Phase 5.

## S1: Check a job
*As a job seeker who got a job link or recruiter message, I want to paste it and learn if it's real, so I don't waste time or get scammed.*

- [ ] Input accepts a URL **or** free text up to 20 000 chars, plus an optional employer name. Zod validates it and the server rate-limits it.
- [ ] A Passport renders in **< 10 s p95** against seeded fixtures. When a live lookup would exceed the budget, we return a partial Passport marked "still checking…" and fill it in, rather than blocking.
- [ ] For a URL on a disallowed domain (LinkedIn, Indeed, Glassdoor…) we **don't fetch**. We ask for the pasted text and say why.
- [ ] We extract title, employer, location, apply URL, salary, contact methods and vacancy statement. Each extracted field shows "from your text" or "extracted automatically".
- [ ] If the check matches an indexed canonical job, the result links to it.
- [ ] Next steps are plain language: "Apply through the employer's site here", or "We couldn't find this on the employer's site. Contact them using details on their official website."
- [ ] The check is stored privately for the user (or the session, if anonymous) and deleted after the retention period. Raw text never appears in app logs.

## S2: Understand why
*As a user, I want to see exactly why a job got its status.*

- [ ] Status shows as icon + text, never colour alone.
- [ ] "Why?" lists every signal with polarity, what we checked, when, where (link) and what it means.
- [ ] HIGH_RISK copy: "This posting shows N patterns common in job scams. Here's what we found." The word "scam" never describes the job itself.
- [ ] Every Passport links to "How verification works", which renders the same rule table the code uses (one source of truth).
- [ ] An admin override shows "Reviewed by Provenant staff on {date}".

## S3: Search and filter
*As a job seeker, I want to search verified jobs and filter by what matters.*

- [ ] Filters: keyword, employer, city/province, remote type, min salary (employer-stated only), employment type, posted within, last confirmed within, status, source type.
- [ ] Sorts: relevance, newest, last confirmed, salary. Jobs without a salary sort last, with a note saying so.
- [ ] Each card shows title, employer, location, salary or "Salary not disclosed", Posted, Last confirmed, status chip, "Found on N sources" and Save.
- [ ] Loading, empty and error states exist. Filters live in the URL, so a search is shareable and saveable.

## S4: Inspect a job
*As a user, I want to see where a job came from and what the salary evidence is.*

- [ ] The detail page runs in this order: overview → Passport → description → skills → salary evidence → source history.
- [ ] Salary is labelled by type in words ("Employer advertised: …"), and a missing salary reads "Salary not disclosed". No estimates in the MVP.
- [ ] "Also found on" lists every source record with its link and last-seen time.
- [ ] We always show both times, **Posted** and **Last confirmed live**, with "may be closed" when the last confirmation is more than 7 days old.

## S5: Apply at the source
*As a user, I want to go straight to the employer's real application page.*

- [ ] **Apply at original source** is the primary CTA, always visible, and opens the canonical employer or ATS URL in a new tab with `rel="noopener"`.
- [ ] If the canonical apply URL fails our own `APPLY_URL_ON_EMPLOYER_OR_KNOWN_ATS` rule, the CTA carries a caution line.
- [ ] Clicking it fires `apply_clicked`.

## S6: Save and alert
*As a returning user, I want to save jobs and hear about new matches.*

- [ ] Sign-up works with email + password (argon2) or a magic link.
- [ ] Save/unsave a job from a card or the detail page, and view saved jobs in a list.
- [ ] "Save this search" stores the current filters. New matching canonical jobs create in-app notifications through a `Notifier` interface, with email to be added in P1.
- [ ] Users can export all their data as JSON and hard-delete their account.
