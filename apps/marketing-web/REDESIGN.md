# Marketing redesign

The `redesign` branch incorporates local `develop` through `c7b767df3` and
`origin/develop` through `ac00417df`.
Work is isolated in `.scratch/marketing-redesign` so other work in the main checkout is unaffected.

## Presentation

`src/features/marketing/pages/` contains separate page compositions for home,
about, contact, resources, the course directory, careers, subsidies, and results.
Only related course detail pages share their section structure. Navigation,
footer, typography, buttons, and small content components are shared.

The visual reference is develop's `/ucat/`: cream, navy, pale blue, spacious
headings, italic emphasis, rounded panels and a floating navigation that becomes
translucent white on scroll. The UCAT product landing remains unchanged. The online-learning route has been
removed; its mountain hero image and three headline statistics now appear on the homepage. Marketing styles are scoped to avoid changing their presentation.

## Production content

Production copy now lives in `src/features/marketing/content/production.json`,
with explicitly approved changes in `editorial-overrides.json`. Native metadata
and structured data live in `src/content/pages.json`. The obsolete WordPress
HTML export, renderer, styles, plugin assets and one-off importer have been removed.
Referenced media lives in `public/images/content`; old upload URLs permanently
redirect there. Existing page and sitemap redirects remain for search continuity.

Hero and navigation copy were redesigned. Duplicate responsive images and the
old placeholder headline were removed. The old homepage instruction to click a
decorative arrow was removed; its subsidy explanation is shown directly. The
production medical interview waitlist replaces the retired trial-booking sections,
just as it does on develop. All 23 published staff profiles and 65 review entries
are retained; bios and additional reviews expand with native accessible controls.

Published prices and dates were preserved, including pre-existing inconsistencies:
the exam preparation hero says $30/hour while its cost section says $50/hour;
the UCAT classes hero lists Currie Street while its location section lists Solomon
Street. Resolving those business details is a separate content change.

## Verification

From the repository root:

```sh
pnpm turbo run build --filter=marketing-web^...
pnpm --filter marketing-web typecheck
pnpm --filter marketing-web lint
pnpm --filter marketing-web exec jest --runInBand
pnpm --filter marketing-web build
```

With marketing-web running locally:

```sh
python3 apps/marketing-web/scripts/verify-marketing-content.py http://127.0.0.1:3013
```

The content audit checks 497 production passages across 14 routes, one main
landmark/H1 per route and local section links. Manual browser checks cover desktop
and mobile layouts, a 320 CSS-pixel viewport, navigation, course guidance,
contact directions and interview waitlist hydration. No forms were submitted.

Marketing build, lint, typecheck and unit tests pass. The full `pnpm checkall`
gate passed repository lint/typechecking with temporary worktree lint isolation,
then stopped at `@altitutor/ucat-app` tests because the sandbox denied a tsx IPC
socket (`listen EPERM`). Later gate stages have not passed. No remote deployment,
remote database operation or changes to the active develop checkout were made.

## September 25 refinement and Sentry review

The homepage uses the original mountain photograph, a UCAT announcement link,
and the requested mission-driven tagline. The footer uses charcoal and accessible
social icon links. The mobile dialog expands from the pill with staggered links,
focus containment, Escape dismissal, focus restoration, and scroll locking.
Page entrances and hover movement respect reduced-motion preferences. Content
remains visible when JavaScript or animation is unavailable.

All-history, all-environment Sentry inventory at 2026-09-25T06:48:06Z returned
exactly two unresolved groups on one page (pagination exhausted):

- **MARKETING-WEB-1 / ALTI-597:** 295 events, latest 2026-09-25T04:50:37Z.
  Representative production events `17cca51a39e047b98bc7a2d4bac1436f` and
  `4e514c56f56041c4b087842f61fe9a13` point at the homepage's DOMContentLoaded
  callback. The production export calls `jQuery(function($)...)` there without
  loading jQuery. The redesign removes that script and presents subsidy content
  directly. `python3 apps/marketing-web/scripts/test-marketing-content.py`
  checks the actual exported homepage and published semantic content, retaining
  subsidy copy while excluding executable legacy markup. Production verification
  is pending; the existing human instruction to leave Sentry unresolved is respected.
- **MARKETING-WEB-4 / ALTI-598:** two production Mobile Safari events, latest
  2026-09-19T09:35:33Z, with `Invalid call to runtime.sendMessage(). Tab not found.`
  Both events lack a stack. Marketing code contains no runtime messaging calls.
  Browser-extension origin is plausible but unproven; no speculative patch or
  broad error suppression was added. The existing investigation remains open
  pending a script origin or reproduction with the affected Safari extension.

No Sentry issues were marked resolved and no production settings were changed.

Final refinement validation: production build generates 31 routes; all 497
content passages pass. Marketing lint/typecheck/Jest and the two legacy-script
regression tests pass. Repository lint/typecheck pass; all 21 repository unit-test
tasks pass when rerun with local IPC permission. The remaining full-gate stages
(coverage, Edge contracts, full workspace build, database contracts and critical
browser journeys) were not completed. Shared local database state was not reset.
Browser checks cover the desktop mountain hero, mobile layouts at 390 and 320px,
white navigation on scroll, menu open/close/Escape, focus restoration and menu
navigation. No browser console errors were observed in these flows.


## Shared theme and course navigation — September 25 follow-up

All published marketing pages, including UCAT, now use the same SiteFrame,
navigation, footer, colour variables, font roles and motion/button primitives.
The primary dark surface is charcoal. UCAT-specific entrance/count animations
and its separate navigation/footer/scroll rail are removed. Interactive product
demonstrations retain their functional behaviour and exam/status colours where
those explain the actual interface. The magnetic fill/scale button treatment is
shared and supports keyboard focus and reduced motion.

The homepage mountain image has a darker overlay and square bottom corners.
Navigation and mobile dialog share the same translucent white and blur tokens.
Top-level course links navigate to their directories; separate desktop disclosure
buttons reveal child links. Mobile navigation lists those groups directly.

New canonical routes:
- `/online-courses/`: online course directory.
- `/online-courses/sace-ib-resources/`: renamed resources page, with focused title,
  description, H1 and canonical/social metadata.
- `/classes/assignment-drafting/`: recontextualised assignment-writing feedback.

Old resources/drafting URLs redirect permanently, and the sitemap uses the new
canonical URLs. Explicit copy changes live in `editorial-overrides.json`, keeping
the production archive intact. Existing prices, session logistics and testimonials
are retained. The preserved-content audit now checks 498 passages including these
approved editorial changes.

Validation: marketing lint, typecheck, unit tests, legacy-script regressions and
production build pass. Browser checks cover desktop course disclosures, mobile
course groups, shared UCAT typography, and renamed routes. No changes were made
to other apps' working files.

## Latest polish

The homepage uses the deployed online-learning image treatment (70% image/gradient
layer over charcoal). Primary buttons are navy; dark cards remain charcoal.
The mobile header itself expands with a reversible grid transition, retaining the
same logo, trigger and background throughout. Inert content, focus trapping,
Escape, focus restoration and reduced-motion support remain in place.
Course templates retain their existing section navigation; other pages use the
shared right-hand section chips. Analytics loads after hydration in a separate
chunk; the hero is excluded from entrance animations to avoid delaying LCP.

Latest validation: production build, lint (zero warnings), TypeScript and four
native-content/metadata tests pass. The content audit verifies 498 passages on
14 routes. Browser checks cover the mountain treatment, navy CTA, section chips,
preserved course navigation and the mobile menu at 320 CSS pixels. Initial JS on
the main page group decreased from 379 kB to 308 kB; online directory/resources
pages are 176 kB. Removed 79.75 MB of legacy assets and retained approximately
23 MB of referenced media under native paths (roughly 54 MB net reduction).
