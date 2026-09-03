# Student Session billing adjustments

## Objective

Allow AdminStaff to credit or replace an already-invoiced Student Session without double-charging or losing a valid charge, while preserving append-only financial history and the existing daily billing workflow.

## Domain rules

A Student Session is chargeable when:

```text
session is billable
AND not a trial
AND (
  actual attendance is true
  OR there is no planned absence
  OR absence billing treatment is charge
)
```

`planned_absence` records expected attendance. The existing boolean combinations remain the storage Adapter for `AbsenceBillingTreatment` during this release:

| Stored state | Treatment |
| --- | --- |
| no Planned absence | none |
| Planned absence and `is_credited` | credit |
| Planned absence and `is_rescheduled` | replacement |
| Planned absence and neither flag | charge |

Actual attendance always makes that Student Session chargeable. Financial history is append-only: an obligation reduced by a Credit note is restored with a new Restoration charge rather than by deleting or reversing the Credit note.

## Command interfaces

- `creditStudentSession`: records a Planned absence with `credit` treatment and synchronises the original obligation.
- `rescheduleStudentSession`: records a Planned absence with `replacement` treatment, assigns exactly one current Replacement session, and synchronises both obligations.
- `changeStudentSessionAbsenceTreatment`: changes an existing treatment, resolves the previous replacement, records a reason, and synchronises every affected obligation.
- `syncSessionBilling`: compares one Session billing obligation with its net linked charges and Credit notes, then creates or supersedes the minimum required Billing adjustment.

StudentWeb may not apply these commands to an already-invoiced Session during the initial release.

## Billing adjustments

Billing adjustments are durable and idempotent. Supported operations are:

- issue a line-level Credit note;
- create an original or replacement Session charge;
- create a Restoration charge linked to the Credit note it restores.

An adjustment records its operation, affected Student Session, source invoice item or Credit note, deterministic idempotency key, dependency, status, attempts, provider identifiers, and last error. Before every attempt, the worker re-evaluates the current obligation and marks stale work `superseded`.

Adjustments are attempted immediately and retried with bounded backoff for approximately 24 hours. Permanently failed or unresolved work remains visible in Financial reconciliation. When replacing an already-charged original after the target billing cutoff, the target charge depends on successful original credit.

## Financial behavior

- Credit the exact historical tuition line. Credit an attributable legacy processing-fee line, but never restore that fee.
- Open invoices are reduced by Credit note. Paid amounts become Customer balance credit. Partial and pending payments follow Stripe's Credit note rules and remain retryable when Stripe temporarily rejects the operation.
- A Replacement session uses its own normal price and Student subsidy.
- Existing Customer balance transactions remain untouched. New direct balance writes are removed after the Credit note workflow ships.
- New payment-processing fee lines stop before the absence-billing rollout.

## Replacement behavior

Replacement eligibility preserves the current same-Subject, different-Class, future/in-range, and not-already-enrolled rules, while excluding inactive or cancelled, trial, and non-billable targets. Capacity and pricing differences warn but do not block AdminStaff.

An original has at most one current Replacement session. When changing it:

- an unbilled and unattended previous assignment is removed;
- an invoiced but unattended previous assignment is retained for history and credited;
- an attended previous assignment remains chargeable;
- a new target links directly to the original rather than forming a replacement chain.

## AdminWeb

Keep the existing `Log absence…` workflow. For every selected Session, AdminStaff explicitly chooses `Reschedule` or `Credit`; one batch may contain both choices. Existing absences use `Manage absence…` to change treatment, select another replacement, or genuinely undo the Planned absence. Do not encode replacement refusal or the previous-day notice policy as billing branches.

Treatment changes require a broad factual reason category and optional note. Admin attendance edits preview any financial consequence; TutorWeb records attendance without displaying financial amounts. Successful Credit note and Restoration charge notifications go to configured invoice recipients only after Stripe succeeds.

## Cutover and reconciliation

Do not automatically adjust pre-cutover discrepancies. A read-only preflight and Financial reconciliation surface existing mismatches for manual review. Reconciliation compares the derived Session billing obligation with net linked invoice and Credit-note records, including previously credited Sessions needing Restoration charges.

Weekly grouped invoicing is out of scope.

## Required verification

Tests must cover, through the agreed public seams:

- every chargeability-rule branch;
- credit and replacement before and after invoicing;
- all original/replacement attendance combinations;
- repeated attendance corrections and append-only charge/credit chains;
- duplicate submissions and deterministic idempotency;
- credit-before-replacement dependency ordering;
- adjustment failure, retry, supersession, and terminal reconciliation;
- open, paid, partially paid, pending, void, and uncollectible invoice states;
- replacement changes with unbilled, invoiced, absent, and attended targets;
- bulk operations with partial provider success;
- mixed credit and reschedule decisions in one absence batch;
- StudentWeb rejection for already-invoiced sources;
- pre-cutover isolation and existing-balance preservation;
- notification deduplication and processing-fee removal.
