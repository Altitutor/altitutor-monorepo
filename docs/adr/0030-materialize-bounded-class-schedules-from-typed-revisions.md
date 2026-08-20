---
status: accepted
---

# Materialize bounded Class schedules from typed revisions

A Class is a stable teaching cohort rather than a single weekly meeting. Each Class owns a bounded, timezone-aware timeline of typed Class schedule revisions, and one authoritative server-side planner materializes those schedules as concrete Class sessions. This supports weekly and fortnightly schedules with multiple weekday/time/room rows, plus explicitly dated Custom class timetables, without exposing unrestricted RRULE semantics.

## Considered options

- Keep one weekday and time on each Class. Rejected because multi-day cohorts would have to be split into false duplicate Classes with separate enrolments and identity.
- Store arbitrary RRULEs. Rejected because the known needs are weekly, fortnightly, and explicitly dated timetables; unrestricted recurrence would make authoring, conflict detection, effective-dated changes, exceptions, and explanations needlessly complex.
- Treat materialized Sessions as disposable cache rows. Rejected because Sessions acquire attendance, staffing, resources, invoices, logs, calendar identity, and independently authored exceptions.

## Consequences

- Recurring revisions repeat every one or two weeks from an explicit anchor and contain one row per weekday, local start/end time, and room. Custom revisions use their explicitly authored Class sessions as the timetable. Every Class has required start and end dates and a named timezone, defaulting to `Australia/Adelaide`.
- Student enrolments and regular tutor assignments remain Class-wide. Individual Session assignments and edits remain exceptions. The first release does not expose switching between recurring and custom schedule types, although the revision model permits it later.
- Schedule changes are made from the Class editor with an effective date of today or later. The server produces an exact reconciliation preview and applies that same plan transactionally. Individual Session editing always affects only that Session.
- Past Sessions are never regenerated, moved, or deleted. Future pristine generated Sessions may be removed; enriched or exceptional Sessions are preserved. Removed Sessions remain temporarily as hidden calendar cancellation tombstones before physical deletion so subscribed calendars can observe cancellation.
- Class identity no longer depends on one meeting time. A shared server-side projection supplies every app and search surface with canonical short and long Class display labels, schedule summaries, matching weekdays, and the next Session.
- `ACTIVE` and `INACTIVE` are the only Class activity statuses; `FULL` is removed. Class-wide inactivation and reactivation use the same preview and reconciliation safeguards. A Class with meaningful history cannot be hard-deleted.
- Class creation uses the existing multi-step-dialog pattern: identity and bounds, recurring/custom timetable, then conflicts and reconciliation preview. Cross-Class room, tutor, and Student conflicts warn but do not block confirmation. No automatic Class schedule-change message is introduced; generated roster changes must not emit per-Session assignment noise.
- Existing Classes are additively backfilled as weekly Adelaide revisions for 1 January through 31 December 2026 without changing any existing Session. Matching 2026 Sessions receive provenance, deviations become exceptions, and older Sessions remain untouched. Rollout is phased across admin, student, tutor, reports, search, messages, and views before legacy scalar schedule columns are removed. Read-only production preflight and post-deployment verification are required; remote schema changes still ship only through CI/CD.
