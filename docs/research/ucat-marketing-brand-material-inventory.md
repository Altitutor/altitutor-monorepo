# Altitutor UCAT — marketing & brand material inventory

Date: 1 September 2026  
Scope: Read-only extraction from the Altitutor monorepo for marketers writing on-brand ads, emails, and print  
Method: First-party docs, design tokens, landing/app source, email package, Edge Functions, and migrations. Quotes are verbatim unless noted.

**Verdict:** The repo already contains a strong brand bible, a working GTM/launch operating plan, live landing copy, email senders/sequences, pricing/referral rules, and analytics contracts. There is **no separate “marketing runbook”** file by that name; the closest equivalents are `docs/plans/ucat-go-to-market-launch.md` and `docs/ucat-email-operations.md`.

---

## 1. Brand system

### Canonical palette and typography

| Token | Hex / family | Source |
| --- | --- | --- |
| Navy / primary | `#0A2941` / `#0a2941` | `docs/ucat-brand-and-customer-experience.md` §5; `packages/shared/src/theme/marketing-tokens.ts` |
| Soft blue / accent | `#92B9C6` / `#92b9c6` | same |
| Warm cream / background | `#F2F0E9` | same |
| Charcoal / dark | `#1A1A1A` | same |
| Heading sans | Plus Jakarta Sans | `marketing-tokens.ts` → `headingSans` |
| Secondary sans | Outfit | `secondarySans` |
| Drama serif | Cormorant Garamond | `dramaSerif` |
| Data mono | IBM Plex Mono | `dataMono` |

Code tokens:

```5:21:packages/shared/src/theme/marketing-tokens.ts
export const MARKETING_TOKENS = {
  colors: {
    /** Brand dark blue */
    primary: "#0a2941",
    /** Brand light blue */
    accent: "#92b9c6",
    /** Cream page background */
    background: "#F2F0E9",
    /** Charcoal for body text on light surfaces */
    dark: "#1A1A1A",
  },
  typography: {
    headingSans: "font-['Plus_Jakarta_Sans',sans-serif]",
    secondarySans: "font-['Outfit',sans-serif]",
    dramaSerif: "font-['Cormorant_Garamond',serif]",
    dataMono: "font-['IBM_Plex_Mono',monospace]",
  },
} as const;
```

Brand guide visual intent: “calm, editorial, credible, and human rather than clinical or futuristic.” Avoid generic stock, lab/science imagery, fictional mockups, excessive gradients/glow/glass.

### App wiring

- UCAT app Tailwind: `apps/ucat-web/tailwind.config.js` — `marketing.primary/accent/cream/charcoal`
- Marketing app Tailwind: `apps/marketing-web/tailwind.config.js` — same hexes
- UCAT globals: `apps/ucat-web/src/app/globals.css` — Google fonts Outfit, Plus Jakarta Sans, Cormorant Garamond, IBM Plex Mono
- Marketing globals: `apps/marketing-web/src/app/globals.css` — also loads Montserrat/Inter for legacy WordPress chrome; UCAT landing uses the marketing tokens above

### Product name & description

- Formal name: **Altitutor UCAT** (`packages/shared` online-product constant; brand doc §1)
- Product description constant: `"UCAT preparation that shows you where you stand and what to do next."` — `apps/ucat-web/src/lib/ucat-brand.ts`
- Avoid publicly: “Alti UCAT”, “Altitutor UCAT System”, “UCAT Pro”

### Logos

Canonical SVGs under `assets/images/` (copied into app `public/images/`):

- Banners: `logo-banner-light.svg`, `logo-banner-dark.svg`, `logo-banner-lightmode.svg`, `logo-banner-darkmode.svg`
- Icons: `logo-icon-light.svg`, `logo-icon-dark.svg`, `logo-icon-lightmode.svg`, `logo-icon-darkmode.svg`

UCAT app chrome uses these SVGs. The UCAT marketing landing navbar is **text-only** (“Altitutor UCAT”), not an SVG logo — `apps/marketing-web/src/features/product-landing/ucat/ucat-landing-navbar.tsx`. Legacy marketing pages still reference a WordPress PNG logo.

### Email visual tokens

`packages/email/src/render-email.ts`: CTA/header navy `#0a2941`; cream panel `#f7f2e8`; blue panel `#eaf1f3`; dark-mode accent near `#92b5c3`. Brand footer tagline for UCAT: “A not-for-profit initiative by Altitutor.”

---

## 2. Brand voice, tone, messaging, goals

**Primary source:** `docs/ucat-brand-and-customer-experience.md` (approved direction).

### Organising ideas

| Role | Quote |
| --- | --- |
| Internal brand idea | “Direction with a conscience.” |
| Customer promise | “Know where you stand. Know what to do next.” |
| Access promise | “Start free. Keep practising free.” |
| Mission | “Better UCAT preparation should not depend on what your family can afford.” |
| Conversion line | “Keep preparing free, or go Unlimited when you want to move faster.” |
| Referral prop | “Give a friend a free start. Earn more time to prepare.” |
| Accountability pricing hook (GTM) | “The more consistently you practise, the less your next Unlimited bill costs.” |

### Voice attributes

Calm, observant tutor: **Clear, Specific, Human, Honest, Encouraging, Equitable.**

Preferred patterns (examples): “Here is what your recent practice suggests.” / “You can keep preparing on Free.” / “You do not need to catch up all at once.”

Avoid: unfair advantage; dominate/hack/crush/guarantee; vague “AI-powered”; competitor attacks; shame about inactivity; treating subsidy recipients as marketing props; “Australia’s only free UCAT platform” (guardrail reviewed July 2026).

AI is “a capability, not the main brand story. Lead with the student outcome.”

### Message hierarchy (customer-facing order)

1. Direction → 2. Access → 3. Capability → 4. Mission → 5. Human support (tutoring later)

### Offer architecture (marketing constraints)

- Plans: **Free** + **Unlimited** only (Pro removed from brand)
- Online tutoring: waitlist label **“Online UCAT tutoring — coming soon”**
- Supported access CTA: **“Apply for supported access”**
- Adelaide in-person: secondary link only — “In Adelaide? Explore in-person UCAT classes.”

### Landing copy deck (approved vs live)

Approved hero in brand doc:

> Know where you stand. Know what to do next.

**Live landing hero** (`ucat-landing-hero.tsx`) currently differs:

> UCAT Prep? / Planned for you.

Live support: “Altitutor UCAT intelligently plans practice around your strengths and weaknesses…”  
Live CTA: “Start preparing free”  
Live proof line: “A not-for-profit initiative by Altitutor.”

Marketers writing to the **approved deck** should prefer the customer promise; writers matching **current live ads** should mirror “UCAT Prep? Planned for you.” Open Graph already uses “UCAT prep, planned for you | Altitutor UCAT” (`apps/marketing-web/src/app/ucat/page.tsx`).

Full approved section copy (nav, problem, how-it-works, free forever, toolkit, mission, founder draft, pricing, tutoring waitlist, final CTA) lives in brand doc §6 — use that file as the copy deck.

### Commercial goal (from GTM plan)

Primary outcome: **50 active, externally acquired, paid Unlimited subscriptions on 31 December 2026** (floor 25 / stretch 100). Funnel hypothesis: 500 qualified signups → 250 activated → 50 paid.

---

## 3. Marketing emails

### Ops map

`docs/ucat-email-operations.md` — triggers, preferences, Resend Topics, lifecycle gate.  
Local preview: `pnpm email:preview` → `http://127.0.0.1:4187`.

### From-names / reply addresses

From `packages/email/src/render-email.ts`:

| Sender key | From | Reply-To | Use |
| --- | --- | --- | --- |
| `altitutor` | `Altitutor <admin@altitutor.com>` | `admin@altitutor.com` | Identity, billing, formal |
| `ucat-product` | `Altitutor UCAT <admin@altitutor.com>` | `admin@altitutor.com` | Product / progress |
| `founder` | `Matt at Altitutor <matt@altitutor.com>` | `matt@altitutor.com` | Welcome, founder, educational |

Brand doc also plans **`ucat@altitutor.com`** as monitored product/support alias (not yet the coded default). Company contact: phone `+61 483 849 842`, address `Level 1, 17A Solomon St, Adelaide SA 5000`.

### Preference topics (lifecycle)

`weekly_progress_and_guidance`, `lessons_and_tips`, `product_news`, `offers_and_referrals`.

### Lifecycle campaigns (implemented)

Keys in `supabase/functions/ucat-lifecycle-emails/logic.ts` include:  
`onboarding_starting_point`, `onboarding_technique`, `onboarding_timing`, `onboarding_plan`, `first_score_estimate`, `weekly_review`, `gentle_restart`, `upgrade_quota`, `upgrade_consistency`, `referral_invitation`.

**Example live subjects** (`supabase/functions/ucat-lifecycle-emails/email.ts`):

- “Your first UCAT session is about 15 minutes”
- “Your week, and one session to do next”
- “Pick up with one session — nothing to catch up”
- “Want to keep practising without waiting for the reset?”
- “Your Unlimited plan can get cheaper as you practice”
- “Give a friend … of Unlimited”

**Brand-doc suggested first-week subjects** (may differ from implemented lesson subjects):  
“You’re in. Let’s find your starting point.” / “Your first useful UCAT score signal” / “Turn your practice into a plan” / etc. — brand doc §8.

### Transactional subjects (samples)

`supabase/functions/ucat-transactional-email-dispatch/email.ts`:

- “We received your supported-access application”
- “You’re on the Altitutor UCAT tutoring waitlist”
- “You’re on the Altitutor interview training waitlist”
- Referral gift / free bill / credit subjects
- Subscription activated, cancellation scheduled/reversed, moved to Free

### Gate

Lifecycle sends require `UCAT_LIFECYCLE_EMAILS_ENABLED=true` after dry-run review — keep `false` until launch (`docs/ucat-email-operations.md`).

Related research: `docs/research/ucat-email-retention-and-conversion.md`, `docs/research/ucat-lifecycle-email-consent.md`, ADR `docs/adr/0019-hybrid-ucat-email-campaign-control.md`, ADR `docs/adr/0024-centralised-email-presentation-and-message-ownership.md`.

---

## 4. Marketing runbooks / launch / growth docs

### Does a “marketing runbook” exist?

**No file named marketing runbook.** Closest operating documents:

| Document | Role |
| --- | --- |
| **`docs/plans/ucat-go-to-market-launch.md`** | **Primary launch operating plan** (19 Aug 2026) |
| `docs/ucat-brand-and-customer-experience.md` | Brand + CX + copy deck + email sequences |
| `docs/ucat-email-operations.md` | Email ops runbook |
| `docs/research/ucat-2026-market-and-go-to-market.md` | Market size, seasonality, competitor snapshot |
| `docs/research/ucat-launch-indexing-strategy.md` | SEO/indexing for `https://altitutor.com/ucat/` |
| `docs/marketing-web-migration.md` | Marketing app migration notes |
| ADRs `0001`, `0002`, `0003`, `0013`, `0012` | Marketing app, freemium, practice-day discount, referral, billing recovery |

### GTM plan — key plays (summarised)

From `docs/plans/ucat-go-to-market-launch.md`:

1. **Goal:** 50 paid external Unlimited by 31 Dec 2026; exclude staff/friends/internal/subsidy/referral-only gifts from the commercial count.
2. **Audience wedge:** ANZ students sitting UCAT ANZ **2027**, beginning/restarting prep, self-directed, want lower-cost + direction.
3. **Three test messages (Week 2):** Direction / Free access / Accountability pricing — tagged landing links; judge by **activated external students**, not views.
4. **First 30 days:** Week 0 readiness → Week 1 founding cohort (10–15) → Week 2 message tests → Week 3 proof + referral → Week 4 amplify winners only.
5. **Channels:** Organic/community loop; tutor QR/UTM cards; partnerships offering something useful; paid only after gates (checkout verified, ≥40% activation, ≥30 activated, some Unlimited intent) then ~$300–$500 test.
6. **Founder-led without influencer persona:** Founder supplies accurate answers/explanations; admin/social packages content; tutors distribute trackable cards without pressure.
7. **Do not lead with:** raw question count, vague AI, guaranteed scores, implied UCAT endorsement, competitor attacks.
8. **Immediate blockers:** mark `internal_test` accounts; PostHog timezone Australia/Adelaide; verify acquisition + signup + billing events; confirm $15/wk & $40/mo; recruit 10–15 external candidates before a large content launch.

Market research note: ~16,950 UCAT ANZ candidates (2025); 1,000 paid ≈ 5.9% of that cohort — not a useful Dec 2026 base case (`docs/research/ucat-2026-market-and-go-to-market.md`).

---

## 5. Altitutor UCAT product — landing, pricing, referral, UTM, PostHog

### Landing page source

| Item | Path / value |
| --- | --- |
| Route | `apps/marketing-web/src/app/ucat/page.tsx` |
| Canonical URL | `https://altitutor.com/ucat/` |
| Composition | `.../ucat/ucat-marketing-landing-page.tsx` |
| Feature folder | `apps/marketing-web/src/features/product-landing/ucat/` (~40+ components) |
| Signup destination | `https://ucat.altitutor.com/signup` via `apps/marketing-web/src/lib/site.ts` |

SEO title: “UCAT preparation Australia and New Zealand | Altitutor UCAT”  
Meta description cites “10,000+ questions, 30+ full mocks…”

### Pricing

Live list prices (migration `supabase/migrations/20260712041509_ucat_referrals_and_accountability_pricing.sql`):

- Unlimited **week = $15** (1500¢)
- Unlimited **month = $40** (4000¢)
- Practice-day discount configured in same migration; yearly checkout **`checkout_enabled = false`**
- GTM plan: “Confirm live pricing remains $15/week and $40/month”; production **trial days = 0**

Landing pricing UI: `ucat-landing-pricing.tsx` — Free $0; Unlimited features include “Full access to 30+ full mocks…”; loads `/api/ucat/subscription-config/`.

Comparison table competitors (hardcoded): MedEntry **$360/yr**, Medify **$65/mo** — `ucat-landing-comparison.tsx`.

### Referral / friend-referral

- Brand proposition: “Give a friend a free start. Earn more time to prepare.”
- Suggested share SMS (brand doc): “I’ve been using Altitutor UCAT to practice and track what to work on next. This link gives you free Unlimited access to get started: [link]”
- In-app copy: `apps/ucat-web/src/features/subscription/lib/referral-offer-copy.ts`
  - Free referrer: “Give a free week of UCAT Unlimited.” — both get week of Unlimited or Free quota reset
  - Paid referrer: gift week/month matching billing; referrer earns free bill
- ADR: `docs/adr/0013-ucat-referral-free-bill-rewards.md`
- UI: `referral-section.tsx`, `referral-gift-card.tsx`

### UTM / first-touch attribution

`packages/shared/src/ucat/acquisition-attribution.ts`:

- Cookie: `ucat_acquisition_first_touch` (180 days)
- Params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Also: referrer domain, landing path (query string excluded from cookie payload per GTM plan)
- Self-reported sources after signup: reddit, tiktok, instagram, facebook, search, friend_or_classmate, altitutor_tutor, school_or_teacher, business_card_or_flyer, other, not_sure

Email CTA UTMs (`supabase/functions/_shared/ucat-email.ts` pattern): `utm_source=altitutor`, `utm_medium=email`, `utm_campaign=<campaign>`.

### PostHog events (marketing / signup / referral-related)

**Marketing-web** (`captureMarketingEvent`):

- Context: `app: "marketing-web"`, `surface: "marketing"`
- `$pageview`
- `marketing_cta_clicked` with `cta_placement` / `cta_action` / `plan_tier`  
  Placements include: `hero`, `navbar`, `pricing`, `how_it_works`, `footer`, `footer_cta`, waitlist success

**UCAT-web** (`captureUcatEvent` / server):

- `signup_started`, `signup_completed`, `first_value_reached`
- `activation_completed`, `learning_activity_completed`
- `plan_selected`, `checkout_started`
- `subscription_downgrade_prompt_*`
- `email_cta_landed` (when landing from email CTAs)

**Stripe webhooks:** `subscription_started`, `subscription_payment_succeeded`, `subscription_renewed`, `subscription_cancellation_scheduled`, `subscription_cancelled`, `payment_failed`  
Paid acquisition conversion: first positive-value `subscription_payment_succeeded` with `is_paid_acquisition_conversion = true`.

**Resend webhooks:** `"email delivered"`, `"email clicked"` (space-separated names).

Env: `NEXT_PUBLIC_POSTHOG_*` on marketing, student, and UCAT apps (`secrets/README.md`).

---

## 6. Launch constraints & placeholder / guarded claims

| Constraint | Where | Detail |
| --- | --- | --- |
| “10,000+” / “30+” proof | Landing features, protocol, page metadata, pricing Unlimited bullets | Brand doc: “Replace or supplement … with verified product and organisational figures when available.” |
| “Pricing coming soon” | `ucat-landing-pricing.tsx` | When live price config missing |
| “Unlimited coming soon” | same | When checkout not configured / disabled |
| “Online tutoring · coming soon” | Pricing + brand guide | Waitlist only |
| Protocol “Coming soon” (mobile app) | `ucat-landing-protocol.tsx` | Mobile app mentioned as coming soon |
| Yearly checkout off | Pricing migration | `checkout_enabled = false` for year |
| Lifecycle emails off by default | Env | `UCAT_LIFECYCLE_EMAILS_ENABLED` |
| Trial days | GTM | Production must be **0**; remove stale five-day-trial QA assumptions |
| Nav coming-soon paths | `apps/ucat-web/.../coming-soon.ts` | `COMING_SOON_PATHS: []` (empty) |
| Competitive claim guardrail | Brand doc | Do not claim “Australia’s only free UCAT platform” |
| Pro tier | Brand doc | Remove from customer-facing language |
| Comparison data | `ucat-landing-comparison.tsx` | Hardcoded MedEntry/Medify cells — treat as vendor-claim snapshot, refresh before ads |
| Soft-launch prerequisites (brand §13) | Brand doc | Founder photo/video, `ucat@`, subsidy policy, soft-launch before paid acquisition |
| Indexing | `ucat-launch-indexing-strategy.md` | Keep `https://altitutor.com/ucat/`; add internal links from homepage / classes |

---

## Quick path map for marketers

1. **Brand bible / copy deck** → `docs/ucat-brand-and-customer-experience.md`
2. **Hex + fonts** → `packages/shared/src/theme/marketing-tokens.ts`
3. **Logos** → `assets/images/logo-*.svg`
4. **Live landing** → `apps/marketing-web/src/app/ucat/page.tsx` + `features/product-landing/ucat/`
5. **Launch ops** → `docs/plans/ucat-go-to-market-launch.md`
6. **Email ops + subjects** → `docs/ucat-email-operations.md` + `packages/email/` + `supabase/functions/ucat-*-email*`
7. **Market evidence** → `docs/research/ucat-2026-market-and-go-to-market.md`

---

## Gaps / conflicts to flag for marketing

1. **Hero mismatch:** approved “Know where you stand…” vs live “UCAT Prep? Planned for you.”
2. **Proof figures:** “10,000+” / “30+” still carry a verify-before-claim note in the brand guide.
3. **`ucat@altitutor.com`:** planned in brand doc; coded senders still use `admin@` / `matt@`.
4. **Lifecycle email subjects:** brand-doc first-week drip vs implemented familiarity-scoped lesson subjects differ — use **implemented** subjects for live campaigns; brand doc for tone.
5. **No standalone “marketing runbook”** — operate from the GTM plan + email ops + brand bible.
