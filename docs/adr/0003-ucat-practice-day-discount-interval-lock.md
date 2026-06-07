# UCAT practice-day discount: per-interval config, billing interval lock, credit forfeiture

Practice-day discounts are configured per billing interval (weekly / monthly / yearly): each interval has its own discount amount per qualifying day and a maximum number of discounts per Stripe billing period. Qualification threshold (`min_questions_per_day`) stays global.

Students may change paid **tier** (UCAT Unlimited ↔ UCAT Pro) on the same billing interval only. **Billing interval cannot change** after first checkout — interval is chosen at subscribe/trial start and is immutable for that subscription lifecycle.

When a subscription ends, any unused practice-day discount credits (pending Stripe invoice items) are **forfeited**. Resubscribing starts with a clean slate. Credits earned while the subscription remains active — including during cancel-at-period-end — still apply to that subscription's remaining invoices.

## Context

The previous model used one global `discount_per_day_cents` and implicitly allowed one credit per calendar day for the full billing period length. Combined with planned billing-interval changes, a student could subscribe yearly, accumulate large pending credits, then move to monthly billing and apply those credits against cheaper invoices.

## Decision

1. **Per-interval discount config** — `discount_per_day_cents` and `max_discounts_per_period` per week/month/year (shared across Unlimited and Pro).
2. **Billing interval lock** — no in-product or self-serve interval changes after checkout.
3. **Credit forfeiture on subscription end** — void pending invoice items and mark credits forfeited when Stripe reports subscription deletion (or equivalent termination).
4. **Cap window** — count credits in the current Stripe billing period; at most one grant per calendar day (student timezone).

## Consequences

- Admin configures three discount rows (week / month / year) alongside plan prices.
- Marketing ideal price uses `base − (discount_per_day × max_discounts)`, not full period day count.
- Subscription management page shows `earned / cap` progress for the current period.
- Stripe Customer Portal should not expose price/plan switches that change billing interval (configure in Stripe Dashboard).
- Tier upgrades (Unlimited → Pro) keep the same interval and continue cap counting in the same billing period.
