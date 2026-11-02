# Soft-delete Students with stable identity recovery

Admin Delete Student retains the Student and all history. Active enrolments, future bookings, subscriptions and open checkouts must first be resolved through their existing workflows. Deleted Students leave normal directories and lose Student access and new activity; deletion does not cancel services or issue refunds. In-person relationship status is a separate concept.

Release the deleted Student's contact details for another Student, parent or staff member, while preserving unrelated live-account ownership. A new identity using those details starts fresh and never inherits the old Student or conversations. An existing authenticated login can restore its original Student; an active AdminStaff member can also explicitly restore that record. Restoration does not reclaim released contacts, re-enable communication consent or recreate ended services. Ambiguous retained credentials cannot choose a Student. Old invitations, booking links and email reset credentials cannot silently restore one.

Matthew selected these semantics in DEV-243. Student merge and Product account deletion remain separate workflows; ADR 0052 continues to govern Product account deletion. Reversing this policy would require an explicit retention and identity decision.
