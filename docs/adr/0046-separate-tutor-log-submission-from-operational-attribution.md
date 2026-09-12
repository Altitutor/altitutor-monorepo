---
status: accepted
---

# Separate Tutor log submission from operational attribution

A Tutor log records its immutable authenticated submitter separately from the Session-assigned staff member on whose behalf it was logged. ADMINSTAFF may correct the operational attribution, but not the original submitter; Check-in attribution must identify conducting staff. The latest editor is stored for convenient display and every edit emits durable history. Legacy attribution is preserved as operational attribution, while an unprovable historical submitter remains unknown rather than being inferred.

This reverses the earlier overloading of `created_by`, which made an administrator-authored log appear to have been submitted by another staff member and also attributed downstream activity to that person. New writes derive submitter and editor identities from the authenticated server session instead of accepting them from clients.
