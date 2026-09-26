# Design system — redesign Checkpoint 2

Approved at Checkpoint 1: **Palette A "Ink & Amber"** + **Fraunces/Inter**. Structure reference
(Checkpoint 1 follow-up): rezolv.com's section flow, adapted — no shared colours, fonts, copy,
icons, or imagery (brief's hard rule).

## Tokens — `src/styles/tokens.css`

Semantic custom properties, light + dark (`prefers-color-scheme` and a `data-theme` override for
a future manual toggle): `--bg --surface --surface-raised --text --text-muted --border --primary
--primary-contrast --accent --accent-contrast --success(-bg) --warning(-bg) --danger(-bg)
--info(-bg)`, plus type scale (`--text-display` … `--text-caption`, fluid via `clamp()`), spacing
(`--space-*`, `--section-py`, `--content-max-width: 1200px`), radius (`sm 6px / md 12px / lg 24px
/ full`), elevation (`--shadow-1..3`), and motion (`--duration-*`, `--ease-out`,
`--duration-marquee`, plus a global `prefers-reduced-motion` rule that zeroes all animation/
transition durations).

**Legacy aliases** (`--fg --muted --line --warn-bg --warn-fg`) point at the new tokens so every
pre-redesign component kept rendering unchanged the moment these tokens landed — no page needed
to be touched to pick up the new palette. New components use the semantic names directly.

Contrast (computed, not eyeballed) for every text/background pairing is in the Checkpoint 1
artifact; the one non-obvious result: white text on the amber accent is only 3.33:1 (fails AA) —
buttons use `--accent-contrast` (ink navy) instead.

## Fonts

Fraunces (display, headings) + Inter (body/UI) via `next/font/google`, wired in
`src/app/layout.tsx` as `--font-fraunces`/`--font-inter` → `--font-display`/`--font-body` in
tokens.css → Tailwind's `font-display`/`font-sans` utilities. Tabular numerals via Tailwind's
built-in `tabular-nums` utility on salary figures and dates.

## Icons

[Lucide](https://lucide.dev) (`lucide-react`) — one stroke weight throughout, used for status
chips, buttons, nav, states.

## Components — `src/components/ui/`

Button (+ButtonLink), Input/Select/SearchBar, FilterChip, StatusChip (icon+text per status, never
colour alone — carried over from the pre-redesign rule), SalaryEvidenceTag (employer/extracted/
pasted, visibly distinct not just worded differently), Card/FeatureCard/TrustBadgeCard,
SectionHeader, Marquee (pill + text variants, pauses on hover, respects reduced motion), Nav
(mega-menu + mobile drawer), Hero, CtaBand, Footer, Dotwork (our own inline-SVG halftone wave —
no borrowed graphic), Tabs, Modal (native `<dialog>`), Toast (+ToastProvider/useToast),
EmptyState/ErrorState/Skeleton/JobCardSkeleton.

`passport.tsx` and `job-card.tsx` (the two shared production components already used across the
app) were restyled in place to use StatusChip/SalaryEvidenceTag/the new tokens — same props, same
data flow, purely visual, so every page that already renders a Passport or a JobCard picked up
the new look immediately without a page-by-page migration.

## `/design`

Dev-only (`notFound()` outside `NODE_ENV !== "production"`, same pattern as `/dev/outbox`) —
every token and component above, every state, at `/design`.

## Known follow-ups for later checkpoints

- Landing, Check, Search, Detail, account/auth pages still use their pre-redesign markup — that's
  Checkpoints 3–4 ("apply to pages"), deliberately not done here.
- `SiteHeader` (the real site header) hasn't been swapped for the new `Nav` primitive yet — same
  reason.
- Admin pages get the same tokens but denser, no marketing graphics — Checkpoint 5.
