---
status: accepted
---

# Model Homework Help as a first-class Scheduled offering

Homework Help is a free, subject-independent, tutor-led drop-in service. It is not a Class cohort and must not derive its behaviour from a synthetic Homework Help Subject or a zero-dollar Class price. It is represented by the first-class `HOMEWORK_HELP` Session type with no billing type. The existing `classes` table and bounded schedule revisions remain the persistence and recurrence mechanism, but now represent the broader Scheduled offering concept.

## Considered options

- Continue identifying Homework Help through the `HOME` Subject. Rejected because Subject identity currently controls billing, payroll export, empty-attendance handling, pay-tier metrics, and Student discovery even though none of those behaviours describe curriculum.
- Add Homework Help to `billing_type`. Rejected because billing type denotes a Student pricing category and non-null billing types participate in billing obligations. Homework Help is structurally non-billable, not a zero-priced billable product.
- Introduce a separate recurring-series schema. Rejected because Homework Help needs the same bounded weekly, fortnightly, custom, exception, staffing, and reconciliation behaviour already implemented for Class schedules.

## Consequences

- A Scheduled offering has an effective-dated offering type of `CLASS` or `HOMEWORK_HELP`. The type is selected during creation. Once Sessions exist, conversion requires the schedule preview rather than an unguarded field edit.
- Class offerings require a Subject and billing type and may propagate cohort enrolments. Homework Help requires neither, never propagates Class enrolments, and always materializes Sessions with `billing_type = NULL`.
- Upcoming active Homework Help is visible to every active in-person Student without creating `sessions_students` rows. Past Homework Help is visible only to Students attached through drop-in participation. Adding a drop-in Student retains the existing Session assignment and tutor-log attendance workflow.
- Homework Help determines its tutor pay category, zero-attendance export treatment, pay-tier metric, labels, and discovery from Session type. Subject-name compatibility is temporary and is removed after the production data migration.
- The production migration retypes the existing `HOME` Scheduled offerings, their Sessions, and tutor-log type snapshots without replacing stable Session identities or changing Student links, attendance, invoice items, invoices, schedule exceptions, or tutor logs. Historical paid and zero-dollar invoices remain immutable financial history.
- The synthetic `HOME` Subject and its price override remain as legacy audit data during the expand/migrate phase, but they no longer control new Homework Help behaviour.
