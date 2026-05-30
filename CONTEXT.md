# Altitutor domain glossary

## Staff pay tiers

- **Pay tier** — A numbered step on the organisation’s single pay ladder. Each tier has a canonical base hourly rate stored in Altitutor (not synced to QuickBooks automatically).

- **Tier requirement** — A configurable threshold attached to tier *N* that must be met before a staff member may advance from tier *N* to tier *N+1*. Requirements are optional per metric; unset kinds do not apply.

- **Eligible for review** — All configured requirements for the next tier are satisfied (including metric overrides). Eligibility does not imply promotion.

- **Tier promotion review** — An admin decision recorded after a check-in: `approved`, `deferred`, or `not_ready`. Only `approved` increments `current_tier_number`. May be linked to a `CHECK_IN` session.

- **Metric override** — An admin-entered additive amount on a stable metric key (e.g. pre-system classes taught), stored in `staff.metric_overrides` JSON.

- **Employment started at** — The date used for tenure requirements; defaults to staff `created_at` and may be edited by admin for migration.
