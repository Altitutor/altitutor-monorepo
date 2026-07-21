# ADR 0016: Separate optional Study plans from rolling next-step guidance

## Status

Accepted

## Context

Students may want Altitutor to schedule a calendar through their UCAT date, or
they may prefer to manage their own timetable while still receiving useful next
steps. Reusing a generated calendar invisibly for the latter would retain dated
work, catch-up behaviour and forecasts that the student explicitly chose not to
use. Computing suggestions afresh on every screen would make them unstable and
could change the apparent priority during navigation.

## Decision

Treat the Study plan as an optional calendar layer over a preparation goal that
exists for every student. Students without a Study plan receive a separately
persisted, ordered pair of rolling next steps. Those next steps are refreshed at
meaningful boundaries such as the first guidance visit of a calendar day,
attempt completion and review completion; they are not generated as dated plan
tasks.

Disabling a Study plan retires its future schedule while preserving its history,
the student's preparation goal and all performance evidence. Enabling it later
generates a fresh future schedule from current evidence and availability.

## Consequences

- No-plan guidance has stable primary and secondary actions without inheriting
  calendar, catch-up or forecast semantics.
- The target score and test timing remain available to dashboard and projection
  experiences in both states.
- Study-plan and no-plan ranking may share evidence and candidate-generation
  utilities, but their persistence and lifecycle remain distinct.
- Switching back to a Study plan cannot revive stale future tasks.
