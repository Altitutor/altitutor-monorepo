# ADR 0021: Shared app-scoped user interface preferences

## Status

Accepted

## Context

Presentation choices such as UCAT toolbar layout, Study suggestions visibility, Lag mode, and theme were either device-local, stored with an unrelated domain profile, or not persisted. Adding more isolated fields would prevent preferences from following a user across devices and repeat storage patterns across product apps.

## Decision

Store non-domain user interface preferences in one user-owned, app-scoped preference store. Each Product app exposes a typed preference interface and validates its own fields; the shared store must not absorb authorization, billing, learning progress, communication consent, timezone, Study plan configuration, or other domain state. UCAT web initially owns toolbar layout and visibility, Study suggestions visibility, Lag mode, and theme preferences.

Student access follows the established role facade: students read through a student view and write only through validated server routes. The base store is not exposed for direct Student or Tutor access. Database changes are developed and verified locally and deployed through CI/CD.

## Consequences

- Interface choices follow the authenticated user across devices while remaining independently typed by app.
- Contextual controls and App settings update the same preference interface.
- Future student, tutor, and admin apps may add their own scoped preference shapes without sharing unrelated fields.
- The deliberately narrow interface-preference definition prevents the store from becoming a generic settings dumping ground.
