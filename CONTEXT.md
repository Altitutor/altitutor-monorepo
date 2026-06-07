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

- **UCAT Pro** — Unlimited online access to all UCAT product areas while an active paid Stripe subscription (or equivalent entitlement) is in place.
  _Avoid_: Paid tier, premium

- **Pro trial** — A one-time, seven-day period of UCAT Pro access. Eligible only if the student has never consumed a Pro trial before. Requires entering payment details at start; converts to a paid UCAT Pro subscription when the trial ends unless the student cancels. When a trial ends without payment, the student returns to UCAT Free — they are not locked out of the product.
  _Avoid_: Free trial (ambiguous with UCAT Free), 7-day trial

- **Pro trial eligibility** — Whether a student may start a Pro trial. False once a Pro trial has ever been started on that account, regardless of outcome (converted, cancelled, or lapsed). Consumed when a Stripe subscription is created with `trialing` status. Admin Force Pro does not consume trial eligibility.
  _Avoid_: Trial available, can trial

- **UCAT onboarding choice** — A required first-login prompt for newly signed-up students: start a Pro trial or explicitly continue on UCAT Free. The student must choose one of the two actions before reaching the dashboard — the modal cannot be dismissed without a choice. Shown once per account. Pro trial can be started later from `/subscribe` or upsell CTAs if still eligible.
  _Avoid_: Signup tier selection, plan picker at signup

- **In-person UCAT access** — An add-on entitlement for tutor-led UCAT class workflows (e.g. assigned sessions and session content). Independent of UCAT Free, Pro trial, and UCAT Pro — a student may hold any combination (e.g. in-person + Free, in-person + Pro).
  _Avoid_: Class subscription, in-person tier

- **Manual online access override** — An admin-granted setting on a student that overrides their Stripe-derived online tier. Values: **Default** (follow Stripe — UCAT Free, Pro trial, or UCAT Pro as normal), **Force Pro** (UCAT Pro without a subscription), **Force Free** (UCAT Free even if subscribed). Independent of in-person access.
  _Avoid_: Manual grant, comp access

- **UCAT Free quota** — A limit on how much of a specific online product area a UCAT Free student may use within a configured time period. Each area has its own quota and period; quotas do not share a pool. Areas: Learn (learning modules), Practice (questions submitted), Sets (set attempts started), Mocks (mock attempts started), Skill trainer (sessions started). A quota of zero disables that area for UCAT Free students.
  _Avoid_: Usage limit, rate limit

- **Quota consumption** — When a UCAT Free quota unit is counted. Practice: first submit on a unique question ID within the period. Sets, mocks, learn modules, and skill trainer sessions: when the attempt or session is started. Consumption timing is independent per area.
  _Avoid_: Usage event, quota hit

- **Quota exhaustion** — What happens when a UCAT Free student reaches an area's limit. Practice: block immediately after submitting the last allowed question — no further submits in that period. Sets, mocks, learn, and skill trainer: allow the current in-progress attempt or session to finish; block starting the next one.
  _Avoid_: Rate limit exceeded, quota reached

- **UCAT Free quota period** — The rolling window for a UCAT Free quota. Configured independently per area (day, week, or month) in admin settings. Boundaries use the student's timezone: calendar day, ISO week (Monday start), or calendar month.
  _Avoid_: Billing period, reset interval

- **Quota usage card** — A reusable student-facing component showing UCAT Free quota usage per area (e.g. "12 / 20 questions today") and an upsell action to Pro. Shown on each online product area's entry point and on the subscription settings page.
  _Avoid_: Usage widget, limit banner

- **Subscribe page** — The authenticated pricing page at `/subscribe` where students compare UCAT Free and UCAT Pro plans. Unauthenticated visitors are redirected to signup first. UCAT Free is the implicit default tier — the Free card is informational (lists quotas) and shows "Current plan" for Free students; it is not a separate signup action.
  _Avoid_: Pricing page, plans page

- **Quota limit modal** — The in-context upsell shown when a UCAT Free student hits an area's quota or tries to start a disabled area (quota of zero). Replaces the former all-or-nothing "Unlock online UCAT access" gate. Message is area-specific; primary action leads to Pro trial or subscribe.
  _Avoid_: Paywall, access gate

- **Quota enforcement** — UCAT Free limits are applied when a student performs a quota-consuming action, not at route entry. UCAT Pro, Pro trial, and Force Pro students are exempt.
  _Avoid_: Route gate, middleware check

- **Online access tier** — A student's current online entitlement, derived in order: admin override (if not Default), then active Pro trial or subscription, otherwise UCAT Free. Independent of in-person access.
  _Avoid_: Plan, subscription tier

- **Practice-day discount** — A UCAT Pro billing perk: complete the configured minimum questions in a calendar day (student timezone) to earn a discount on the next bill. Applies to UCAT Pro subscribers only; UCAT Free practice does not contribute.
  _Avoid_: Daily discount, practice credit
