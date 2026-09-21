# Editing tasks, issues, projects and documents

Opening an existing record attempts to acquire a 45-second server lease. The lease
belongs to one session, not one person: another tab of the same account is read-only.
The owner sends a heartbeat every ten seconds. Opening, refreshing and typing never
change the saved record. Save publishes changed fields; Cancel changes discards the
current unsaved changes. Dialog backdrops and Escape never close these editors.
Closing through X asks whether to save, discard or keep editing when the draft is dirty.

A shared controller handles all four record types and both document page/dialog views.
Local recovery drafts are scoped to the authenticated user, record and editing instance.
They are written as the form changes and removed only after acknowledgement or explicit
discard. Storage failures are visible. Recovered drafts are shown separately and can be
copied or downloaded with their original formatting; they never silently replace the
latest record. Recovery is local to this browser, not a backup against clearing browser
storage or losing the device.

Read-only sessions poll every two seconds for saved content and the current owner's
unsaved preview. Typing publishes a preview after 400 ms of idle time. Preview content
is separate from the actual record and its change history. Save/Cancel/release clear the
preview; an expired lease makes it invisible. No CRDT, merging or diff editor is involved.

On connection/lease loss, editing stops and the draft remains available. The owner can
copy it and explicitly open the latest record in a fresh session while retaining the old
draft as a separate recovery copy. A stale token can neither save nor renew itself.

The database locks the entity row before reading/changing its lease and validates the
session token, authenticated user, OAuth client and expiry in the same transaction as
Save. All staff/MCP operational writes respect this lease. Short board/MCP operations
continue to use their read revisions because their lease does not span their earlier
read; long-lived UI editors need only their token. Save request keys make retries within
a session idempotent. Before/after history is retained for successful record changes.
Direct writes with an authenticated user must go through the protected RPC; trusted
maintenance and referential actions may update unlocked records but cannot interrupt a
live editor. No remote database changes are made by local development: the migration
ships through the normal CI/CD pipeline.

Validation covers load-without-write, explicit Save, draft preservation, stale sessions,
second tabs, previews, and save retry receipts. `supabase/tests/work_item_edit_sessions_test.sql`
checks server enforcement and `features/work-item-editing/__tests__/editor-lifecycle.test.tsx`
checks the client lifecycle. Existing MCP workflow tests also exercise the protected
short-operation path.
