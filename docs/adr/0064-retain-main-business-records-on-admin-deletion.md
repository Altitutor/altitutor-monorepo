# Retain main business records on admin deletion

Matthew selected retained deletion for main AdminWeb business records in DEV-276: Staff, Parents, Classes, Subjects, Topics, Tasks, Projects, Issues, Documents, empty Document folders and Admin shifts, Sessions and Tutor logs. Deletion hides a record from ordinary directories and new activity while preserving its row and linked history; live services/work must be resolved through their existing workflows first. This replaces destructive cascades without treating deletion as cancellation.

Staff and Parent deletion releases contact details, detaches that role from its login and preserves unrelated roles sharing the same login. Restoration is an explicit active-AdminStaff action; it does not reclaim contact details, restart services or reactivate Staff access. Student recovery remains governed by ADR 0061. Previously hard-deleted records cannot be reconstructed by this change.

The Settings Deleted entities directory identifies retained records by type and name. Financial and learning-content records keep their existing recovery rules; configuration deletion and physical attachment-storage deletion remain separate. Actor snapshots and the existing work-item editing leases preserve accountability and concurrent-edit protection.

Deleted Topics leave the live sibling ordering; restoration appends them to the current siblings so it does not overwrite a position taken since deletion.

Expired pristine generated calendar cancellation tombstones use the existing maintenance entry point, which now archives them instead of physically deleting them. System maintenance snapshots have no human deletion actor. Active or authored Sessions are outside this maintenance boundary.

Retained Staff/Parent Auth identities reject physical Auth deletion, including the separate cleanup request made by older Staff endpoints. This protects shared roles and identity-linked history while application versions roll forward.
