# Altitutor domain glossary

## Public web surfaces

- **Marketing site** — The public, search-indexable website served from `altitutor.com`. It presents Altitutor's courses, resources, company information, and acquisition pages; it does not own authenticated learning, booking, checkout, or account workflows.
  _Avoid_: Main site, WordPress site, landing pages

- **Product app** — A user-facing application that owns an authenticated or transactional product workflow, such as the student portal or UCAT practice app. Product apps may have public entry pages, but their product workflows are separate from the Marketing site.
  _Avoid_: Landing site, marketing app

## UCAT content

- **UCAT mock exam** — A complete practice exam made of UCAT section content that students can attempt as an exam-like experience.

- **UCAT section** — One of the canonical UCAT areas, such as Verbal Reasoning, Decision Making, Quantitative Reasoning, or Situational Judgement.

- **Question stem** — The shared prompt, passage, scenario, table, image, or setup that one or more UCAT questions refer to.

- **Answer option** — One selectable response for a UCAT question.

- **Bulk import** — A tutor workflow for turning pasted source exam content into UCAT question stems, questions, answer options, and answer metadata for review and import. Explanations are always required on import. The answers step supports either a bulk answers document (auto-parsed) or per-question entry in global question order. Multiple-choice: correct answer via option radio; default explanation scope is question-level (toggleable per question to per-option). Syllogism: per-option Yes/No; default explanation scope is per-option. Rich text in all explanation fields.

- **Separate stem document (bulk import)** — A bulk import input mode where question stems are pasted from one document and questions from another. Each parsed stem is paired with its own question paste area in one scrollable step. The paste-stems step shows live stem count, truncated previews, and in-editor markers at each split boundary. Per-stem question pastes are parsed questions-only; stem-like content in a question paste triggers a row warning. Uses a six-step wizard (section → paste stems → per-stem questions → answers → review → create set). The default combined-document flow uses five steps (section → paste document → answers → review → create set).

- **Stem split marker** — A delimiter in a separate stem document that begins a new question stem. Marker lines are not included in stem text; content before the first marker is discarded. Numbers need not be consecutive or start at 1. Keyword mode: tutor supplies a prefix (e.g. `Prompt`); split at lines matching prefix + number. Stem-numbers mode: split at line-start `N.` or `N)` only (numbered lists inside passage text do not split). Line-breaks mode: split after N consecutive blank lines (whitespace-only lines count); if none found, treat as one stem and warn.
  _Avoid_: Stem keyword, passage header

## Staff pay tiers

- **Pay tier** — A numbered step on the organisation’s single pay ladder. Each tier has a canonical base hourly rate stored in Altitutor (not synced to QuickBooks automatically).

- **Tier requirement** — A configurable threshold attached to tier *N* that must be met before a staff member may advance from tier *N* to tier *N+1*. Requirements are optional per metric; unset kinds do not apply.

- **Eligible for review** — All configured requirements for the next tier are satisfied (including metric overrides). Eligibility does not imply promotion.

- **Tier promotion review** — An admin decision recorded after a check-in: `approved`, `deferred`, or `not_ready`. Only `approved` increments `current_tier_number`. May be linked to a `CHECK_IN` session.

- **Metric override** — An admin-entered additive amount on a stable metric key (e.g. pre-system classes taught), stored in `staff.metric_overrides` JSON.

- **Employment started at** — The date used for tenure requirements; defaults to staff `created_at` and may be edited by admin for migration.

## UCAT online access

- **UCAT Free** — The default online entitlement for a signed-up UCAT student. Grants access to online product areas within configurable, independent usage quotas per area. Does not require a Stripe subscription. A quota of zero for an area means UCAT Free students cannot start that activity.
  _Avoid_: Free trial, free plan

- **UCAT Unlimited** — Unlimited online access to all UCAT product areas while an active paid Stripe subscription (or equivalent entitlement) is in place. Includes practice-day billing discounts. The middle paid tier on the subscribe page.
  _Avoid_: UCAT Pro (former name for this tier), online tier

- **UCAT Pro** — Everything in UCAT Unlimited, plus human support entitlements: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. The top paid tier on the subscribe page; requires its own Stripe product.
  _Avoid_: Premium, coaching tier

- **Unlimited trial** — A one-time, seven-day trial of unlimited online access. Eligible only if the student has never consumed a trial before. Requires entering payment details at start. May be started from either the UCAT Unlimited or UCAT Pro card on the subscribe page; both share one trial allowance per account. The trial window is fixed at seven days from first start — canceling or converting early does not reset or extend it. During the trial, the student receives UCAT Unlimited entitlements only — UCAT Pro human-support entitlements begin when the subscription becomes paid (`active`), not during `trialing`. The student may cancel or let the trial convert to paid at any point within those seven days. On conversion, the student is billed for whichever paid tier they chose at checkout (Unlimited or Pro). When a trial ends without payment, the student returns to UCAT Free — they are not locked out of the product.
  _Avoid_: Pro trial (ambiguous — trial of Pro card is still online-only until paid), free trial (ambiguous with UCAT Free), 7-day trial

- **Unlimited trial eligibility** — Whether a student may start an Unlimited trial. False once a trial has ever been started on that account, regardless of which card was used or outcome (converted, cancelled, or lapsed). Consumed when a Stripe subscription is created with `trialing` status. Admin comp overrides do not consume trial eligibility.
  _Avoid_: Pro trial eligibility, trial available, can trial

- **UCAT onboarding choice** — A required first visit to `/subscribe` for newly signed-up students: start an Unlimited trial or explicitly continue on UCAT Free. The student cannot reach the rest of the app until one action is recorded. Shown once per account. Unlimited trial can be started later from `/subscribe` or upsell CTAs if still eligible.
  _Avoid_: Signup tier selection, onboarding modal

- **In-person UCAT access** — An add-on entitlement for tutor-led UCAT class workflows (e.g. assigned sessions and session content). Independent of UCAT Free, Unlimited trial, UCAT Unlimited, and UCAT Pro — a student may hold any combination (e.g. in-person + Free, in-person + Pro).
  _Avoid_: Class subscription, in-person tier

- **Manual online access override** — An admin-granted setting on a student that overrides their Stripe-derived online tier. Values: **Default** (follow Stripe), **Force Free** (UCAT Free even if subscribed), **Force Unlimited** (UCAT Unlimited without a subscription), **Force Pro** (paid UCAT Pro entitlements including human-support, without a subscription). Unlimited trial cannot be forced. Independent of in-person access. No legacy subscriber migration is required — UCAT paid subscriptions are greenfield.
  _Avoid_: Manual grant, comp access

- **UCAT Free quota** — A limit on how much of a specific online product area a UCAT Free student may use within a configured time period. Each area has its own quota and period; quotas do not share a pool. Areas: Learn (learning modules), Practice (questions submitted), Sets (set attempts started), Mocks (mock attempts started), Skill trainer (sessions started). A quota of zero disables that area for UCAT Free students.
  _Avoid_: Usage limit, rate limit

- **Quota consumption** — When a UCAT Free quota unit is counted. Practice: first submit on a unique question ID within the period. Sets, mocks, learn modules, and skill trainer sessions: when the attempt or session is started. Consumption timing is independent per area.
  _Avoid_: Usage event, quota hit

- **Quota exhaustion** — What happens when a UCAT Free student reaches an area's limit. Practice: block immediately after submitting the last allowed question — no further submits in that period. Sets, mocks, learn, and skill trainer: allow the current in-progress attempt or session to finish; block starting the next one.
  _Avoid_: Rate limit exceeded, quota reached

- **UCAT Free quota period** — The rolling window for a UCAT Free quota. Configured independently per area (day, week, or month) in admin settings. Boundaries use the student's timezone: calendar day, ISO week (Monday start), or calendar month.
  _Avoid_: Billing period, reset interval

- **Quota usage card** — A reusable student-facing component showing UCAT Free quota usage per area (e.g. "12 / 20 questions today") and an upsell action to UCAT Unlimited. Shown on each online product area's entry point and on the subscription settings page.
  _Avoid_: Usage widget, limit banner

- **Subscribe page** — The authenticated pricing page at `/subscribe` where students compare UCAT Free, UCAT Unlimited, and UCAT Pro. A billing-interval selector (weekly / monthly / yearly) above the cards sets the cadence for both paid tiers. Unauthenticated visitors are redirected to signup first. UCAT Free is the implicit default tier — the Free card is informational (lists quotas) and shows "Current plan" for Free students; it is not a separate signup action.
  _Avoid_: Pricing page, plans page

- **Per-week marketing price** — The headline price on paid plan cards, always shown per week (e.g. `$20/wk`), with a secondary line for the actual bill amount for the selected interval (e.g. `Billed at $1,040/yr`). Converted from the configured period price using day-accurate ratios — not shortcuts such as "four weeks per month". Weekly: as configured; monthly: period price × 7÷30; yearly: period price × 7÷365. Penalty (undiscounted) and practice-day ideal prices use the same conversion; ideal uses the practice-day ideal price for the selected interval. Currency displays as `$` for students in an Australian timezone and `A$` otherwise.
  _Avoid_: Weekly equivalent, normalized price

- **UCAT plan price** — Admin-configured list price for one paid tier at one billing interval (Unlimited or Pro × weekly, monthly, or yearly), including the linked Stripe price ID. UCAT Free has no plan prices. Two Stripe products (Unlimited, Pro); each interval is a separate price on the same product. Fortnight billing is not offered.
  _Avoid_: Stripe price, marketing tier

- **Quota limit modal** — The in-context upsell shown when a UCAT Free student hits an area's quota or tries to start a disabled area (quota of zero). Replaces the former all-or-nothing "Unlock online UCAT access" gate. Message is area-specific; primary action leads to Unlimited trial or subscribe to UCAT Unlimited.
  _Avoid_: Paywall, access gate

- **Quota enforcement** — UCAT Free limits are applied when a student performs a quota-consuming action, not at route entry. UCAT Unlimited, UCAT Pro, Unlimited trial, and admin-granted unlimited overrides are exempt.
  _Avoid_: Route gate, middleware check

- **Online access tier** — A student's current online entitlement: `free`, `unlimited_trial`, `unlimited`, or `pro`. Derived in order: admin override (if not Default), then active subscription, otherwise UCAT Free. `unlimited_trial` applies while Stripe status is `trialing`, regardless of whether checkout was for Unlimited or Pro — human-support entitlements are not included. `pro` (paid) implies all UCAT Unlimited entitlements plus UCAT Pro human-support entitlements. Independent of in-person access.
  _Avoid_: Plan, subscription tier, marketing tier name

- **UCAT Pro human-support entitlements** — The tutor-led benefits included in paid UCAT Pro only: one online training workshop per month, on-demand help from tutors, and one 1-1 performance review per month. Not active during Unlimited trial, including trial checkout via the Pro card. In-product fulfillment (booking, metering) is out of scope until a later release; paid Pro is distinguished in access tier only.
  _Avoid_: Coaching add-on, premium support

- **Plan availability** — A paid tier or billing interval is offered on the subscribe page only when admin has configured the corresponding Stripe product and plan price. Unconfigured tiers show a student-facing "Coming soon" state instead of checkout. UCAT Free is always available.
  _Avoid_: Plan disabled, tier locked

- **Practice-day discount** — A paid-tier billing perk: complete the globally configured minimum questions in a calendar day (student timezone) to earn a fixed discount amount off the student's bill. The discount amount and earning cap are configured per billing interval (weekly / monthly / yearly), shared across UCAT Unlimited and UCAT Pro — tier affects only the base (penalty) bill, not the discount rules. Each qualifying day earns that interval's configured amount, up to the practice-day discount cap. Applies to UCAT Unlimited and UCAT Pro subscribers, including during Unlimited trial (`trialing`); credits earned during trial reduce the first paid invoice when the trial converts. UCAT Free practice does not contribute.
  _Avoid_: Daily discount, practice credit

- **Practice-day discount cap** — The maximum number of practice-day discounts a student can earn in one Stripe billing period (`current_period_start` through `current_period_end`) for their current billing interval. Configured per billing interval; admin may set any value from 1 up to that interval's canonical period day count (7 for weekly, 30 for monthly, 365 for yearly). Once the cap is reached, further qualifying practice days in that period earn no additional discount until the next period. A student may earn at most one practice-day discount per calendar day (student timezone), regardless of how many qualifying sessions they complete that day.
  _Avoid_: Max credits, discount limit

- **Practice-day ideal price** — The lowest marketing price shown for a paid plan at a given billing interval, assuming the student earns the practice-day discount on every day allowed by the cap: `base plan price − (discount per qualifying day × practice-day discount cap)`. Displayed per week on plan cards using the same day-accurate conversion as other marketing prices.
  _Avoid_: Best price, floor price

- **Practice-day qualification threshold** — The minimum number of submitted question attempts in one calendar day (student timezone) required to earn a practice-day discount. One global setting for all billing intervals and paid tiers. UCAT Free attempts do not count.
  _Avoid_: Daily minimum, questions per day

- **Practice-day discount grant** — The moment a qualifying day is recorded: a fixed discount amount (from the config at grant time) is written as a credit and applied as a pending Stripe invoice item on the student's subscription. Grants are immutable — admin config changes affect only future grants, not credits already earned in the current or prior periods.
  _Avoid_: Discount credit, practice reward

- **Practice-day discount progress** — A student-facing count of how many practice-day discounts they have earned in the current Stripe billing period versus the practice-day discount cap for their billing interval (e.g. `8 / 20`). Shown on the subscription management page. Pending invoice items from prior periods are not re-counted toward the current period's cap.
  _Avoid_: Discount tracker, credits earned

- **Practice-day discount forfeiture** — When a paid UCAT subscription ends (cancel completes, trial lapses without payment, or payment failure terminates access), any unused practice-day discount credits that have not yet been applied to an invoice are voided. A student who later resubscribes — on any interval — starts with no banked credits from the prior subscription. While a subscription remains active — including during a cancel-at-period-end window — the student may still earn practice-day discounts and those credits apply to that subscription's remaining invoices; forfeiture applies only to what is still pending when access actually ends.
  _Avoid_: Credit expiry, lose discounts

- **Billing interval lock** — A student's billing interval (weekly / monthly / yearly) is chosen at first paid checkout (or Unlimited trial start) and cannot be changed afterward. Interval is not a plan-change dimension — only tier (UCAT Unlimited ↔ UCAT Pro) may change on an existing subscription. Prevents practice-day discount credits earned under one interval's economics from being applied after switching to a shorter interval.
  _Avoid_: Billing cadence change, switch to monthly

- **UCAT subscription plan change** — A change to a paid student's tier between UCAT Unlimited and UCAT Pro on the **same billing interval**. A student may have at most one active UCAT subscription at a time. The stored plan always reflects what the student has actually paid for. Billing interval changes are not permitted — see billing interval lock. Moving between UCAT Free and a paid tier is subscribe or cancel, not an in-place plan change.
  _Avoid_: Plan switch, change plan

- **Immediate subscription upgrade** — A tier increase from UCAT Unlimited to UCAT Pro on the same billing interval. New entitlements take effect immediately. The student pays a one-time prorated charge for the tier price difference over the remaining days in the current billing period; the next renewal bills at the full Pro price. No credit is applied for unused time on Unlimited — only the forward-looking differential is charged. Practice-day discount rules are unchanged (shared across tiers); practice-day discount progress continues in the same billing period.
  _Avoid_: Scheduled upgrade, free upgrade

- **Scheduled subscription downgrade** — A tier decrease from UCAT Pro to UCAT Unlimited on the same billing interval. The student may request it at any time; Pro entitlements and billing continue until the end of the current billing cycle, then Unlimited takes effect. No proration or partial refunds.
  _Avoid_: Immediate downgrade, prorated refund
