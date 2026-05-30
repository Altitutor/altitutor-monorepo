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

- **Bulk import** — A tutor workflow for turning pasted source exam content into UCAT question stems, questions, answer options, and answer metadata for review and import.

## Staff pay tiers

- **Pay tier** — A numbered step on the organisation’s single pay ladder. Each tier has a canonical base hourly rate stored in Altitutor (not synced to QuickBooks automatically).

- **Tier requirement** — A configurable threshold attached to tier *N* that must be met before a staff member may advance from tier *N* to tier *N+1*. Requirements are optional per metric; unset kinds do not apply.

- **Eligible for review** — All configured requirements for the next tier are satisfied (including metric overrides). Eligibility does not imply promotion.

- **Tier promotion review** — An admin decision recorded after a check-in: `approved`, `deferred`, or `not_ready`. Only `approved` increments `current_tier_number`. May be linked to a `CHECK_IN` session.

- **Metric override** — An admin-entered additive amount on a stable metric key (e.g. pre-system classes taught), stored in `staff.metric_overrides` JSON.

- **Employment started at** — The date used for tenure requirements; defaults to staff `created_at` and may be edited by admin for migration.
