# Supabase Realtime Audit

Date: 2026-06-25

## Summary

Repo search covered `.channel(`, `.on('postgres_changes'`, `.on("postgres_changes"`, `.subscribe(`, `removeChannel`, and `removeAllChannels`.

All direct subscriptions now have a cleanup path. One leak was fixed in `apps/admin-web/src/features/messages/components/MessageThread.tsx`, where the cleanup was returned inside an async `.then()` callback and was not used by React.

## Subscriptions

| File | Channel | Table | Event | Filter | Cleanup | Product-critical | Suggested optimisation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/student-web/src/features/billing/hooks/usePaymentMethods.ts` | `payment-methods-${studentId}` | `student_payment_methods` | `*` | `student_id=eq.${studentId}` | `removeChannel` | Medium: webhook/payment UI freshness | Keep for now; fallback polling exists after optimistic updates. Consider removing publication later if polling proves sufficient. |
| `apps/student-web/src/features/notifications/hooks/useNotificationsRealtime.ts` | `notifications-changes` | `notifications` | `INSERT`, `UPDATE` | `student_id=eq.${studentId}` | `removeChannel` | Medium | Keep filtered. Consider polling-only if notification realtime load appears in publication metrics. |
| `apps/tutor-web/src/features/notifications/hooks/useNotificationsRealtime.ts` | `notifications-changes` | `notifications` | `INSERT`, `UPDATE` | `staff_id=eq.${tutorStaffId}` | `removeChannel` | Medium | Keep filtered. Batch mark-read now reduces write/request fanout. |
| `apps/admin-web/src/features/notifications/hooks/useNotificationsRealtime.ts` | `notifications-changes` | `notifications` | `INSERT`, `UPDATE` | `staff_id=eq.${staffId}` | `removeChannel` | Medium | Keep filtered. Admin automation already has bulk mark-read. |
| `apps/admin-web/src/features/messages/hooks/useMessageSubscription.ts` | `messages-inbound` | `messages` | `INSERT` | none, handler filters `direction === 'INBOUND'` | `removeChannel` | High: inbound message UX | Add server-side filter if possible, e.g. direction-specific generated column/RPC alternative. Avoid removing `messages` publication. |
| `apps/admin-web/src/features/messages/components/ConversationList.tsx` | `conversations-list` | `conversations`, `messages` | `*` | none | `removeChannel` | High: inbox freshness | Consider debounced invalidation and narrower events (`INSERT`/status updates) if list churn is high. |
| `apps/admin-web/src/features/messages/components/MessageThread.tsx` | `messages-contact-${contactId}` | `messages`, `conversations` | `INSERT`, `UPDATE`, `*` | `conversation_id=in.(...)`, `contact_id=eq.${contactId}` | `removeChannel`; fixed async cleanup leak | High: open thread freshness | Keep. Consider subscribing only to active conversation IDs instead of all open/snoozed contact conversations if thread volume grows. |
| `apps/admin-web/src/shared/hooks/useSupabaseRealtimeInvalidation.ts` via tasks hooks | `admin-realtime-tasks-*` | `tasks` | `*` | none | `removeChannel` | High: admin tasks page should show other users' changes without reload | Keep in publication. Debounced invalidation now reduces refetch storms. |
| same shared hook via issues hooks | `admin-realtime-issues-*`, `admin-realtime-issue_tags-*` | `issues`, `issue_tags` | `*` | none | `removeChannel` | High: admin issues page should show other users' changes without reload | Keep in publication. Detail/entity subscriptions now respect `enabled`; invalidations are debounced. |
| same shared hook via projects hooks | `admin-realtime-projects-*` | `projects` | `*` | none | `removeChannel` | High: admin projects page should show other users' changes without reload | Keep in publication. Detail subscriptions now respect `enabled`; invalidations are debounced. |
| activity feed hooks | none | `activity_events` | none | none | not applicable | Low: activity feeds do not need live updates | Realtime removed from activity hooks. Remove `activity_events` from publication. |
| same shared hook via shared notes hooks | `admin-realtime-notes-*` | `notes` | `*` | none | `removeChannel`; gated by enabled/target id | High: notes should show other users' changes without reload | Keep in publication. Debounced invalidation now reduces refetch storms. |
| same shared hook via notes document hooks | `admin-realtime-notes_documents-*` | `notes_documents` | `*` | none | `removeChannel`; gated by enabled/note or list visibility | High: note document lists should stay fresh | Keep in publication; already debounced. |
| same shared hook via daily notes hooks | `admin-realtime-notes_daily-*` | `notes_daily` | `*` | none | `removeChannel`; gated by date | Medium/High: daily notes should remain live | Keep in publication; already debounced. |
| same shared hook via folders hooks | `admin-realtime-notes_folders-*` | `notes_folders` | `*` | none | `removeChannel` | Medium/High: note folder tree should remain live | Keep in publication. Debounced invalidation now reduces refetch storms. |
| same shared hook via document edit locks | `admin-realtime-note_document_edit_locks-*` | `note_document_edit_locks` | `*` | none | `removeChannel`; now gated by note id | High while editing | Keep for collaborative lock correctness unless replaced with polling. |

## Publication Proposal

Created a migration file that is intended for the normal reviewed migration flow, not direct production execution:

`supabase/migrations/20260625042338_performance_realtime_publication_proposal.sql`

It removes only `activity_events` from `supabase_realtime`, guarded by a `pg_publication_tables` existence check.

It intentionally keeps `issues`, `issue_tags`, `projects`, `tasks`, `notes`, `notes_daily`, `notes_documents`, `notes_folders`, `note_document_edit_locks`, `messages`, `conversations`, and `conversation_reads`.
