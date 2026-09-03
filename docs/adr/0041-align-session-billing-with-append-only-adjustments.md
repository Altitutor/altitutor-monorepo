---
status: accepted
---

# Align Session billing obligations through append-only adjustments

Core tutoring billing derives each Session billing obligation from billability, trial status, Planned absence, Absence billing treatment, and actual attendance. Commands that can change that obligation enqueue durable, idempotent Billing adjustments and attempt them immediately; bounded retries and Financial reconciliation handle incomplete work. Finalised financial history remains append-only: Credit notes reduce existing charges and Restoration charges re-establish obligations when actual attendance overrides an earlier credit. This keeps billing policy out of Stripe state and avoids both direct customer-balance edits and a general-purpose scheduled billing reconciler.

## Consequences

- AdminWeb exposes separate credit and reschedule commands, while treatment changes remain policy-independent and require an Absence treatment reason.
- A replacement charge waits for any required original Credit note, preferring temporary undercollection to double-charging.
- Existing `is_credited` and `is_rescheduled` storage remains behind a persistence Adapter for the initial release; replacing it requires a later expand–migrate–contract rollout.
- Existing financial discrepancies are reviewed rather than automatically adjusted at cutover, and weekly grouped invoicing remains out of scope.
