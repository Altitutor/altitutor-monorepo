---
status: accepted
---

# Authorize Check-in logging at the portal boundary

Any active ADMINSTAFF may submit or edit a Tutor log for any Check-in, with operational attribution to any staff member assigned to that Session. TutorWeb only presents unlogged Check-ins to conducting tutors and rejects receiving-tutor submissions at its API boundary. The Tutor log RPC retains assignment, actor, and provenance validation but does not encode portal-specific conducting-versus-receiving access, because it is callable only by trusted server roles.

This supersedes ADR-0046 only where it required Check-in operational attribution to identify conducting staff; its separation of immutable submission provenance from operational attribution remains accepted.
