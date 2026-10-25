---
status: accepted
---

# Separate interview participation from assessment

Following the DEV-8 review, Matthew approved the lifecycle fixes and polling
optimizations in DEV-233. Tutor and student portals use one interview round
participation module with their existing authenticated adapters. The module owns
realtime recovery, bounded fallback reads, nonoverlapping heartbeats and wakeups
at server phase deadlines. Results viewing keeps read recovery without live
presence writes. Presence is a liveness hint; deliberate tutor readiness,
assessment completion and media authorization remain separate.

Presence updates validate participation without taking the assessment round's
update lock or building its rich projection. The database still serializes real
assessment and phase changes. Server deadlines, scoped reads and final media
authorization checks remain authoritative; realtime is an invalidation hint.

Explicitly idle in-person stations may acknowledge readiness, but an all-idle
rotation cannot start. A missed encounter with an explicit not-assessed reason
can resolve completion without claiming attendance. Shared question wording,
rubric revisions and immutable result releases retain ADR0057/0058 behavior.

Keep browser recovery optional to authoritative assessment saving. Storage
failure exposes degraded recovery while serial saves, version conflicts and
stable retry identities continue. Round creation likewise retains its submitted
identity and details across an unknown response outcome.
