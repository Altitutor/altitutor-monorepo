# Shared app-scoped notification inbox

Altitutor uses the existing recipient-specific `notifications` inbox across student, UCAT, and staff applications, with each item owned by one application surface. This avoids duplicating read state, deduplication, administration, and delivery infrastructure in a UCAT-only table while preventing UCAT notices from leaking into the general student portal; realtime transport remains an optional invalidation mechanism rather than the source of truth.
