-- Remove activity events from Supabase Realtime publication.
--
-- Do not run this directly against production. Apply through the normal
-- reviewed migration flow after staging verification.
--
-- Context:
-- - pg_stat_statements showed realtime.list_changes(...) as the largest total
--   DB workload.
-- - Activity feeds do not need live cross-user updates.
-- - Issues, projects, tasks, notes, note document lists, edit locks, and
--   messaging still need live updates and intentionally remain published.
--
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.activity_events;
  END IF;
END $$;
--
-- Kept in publication because current product behavior expects live updates:
-- - public.tasks
-- - public.issues
-- - public.issue_tags
-- - public.projects
-- - public.notes
-- - public.notes_daily
-- - public.notes_documents
-- - public.notes_folders
-- - public.note_document_edit_locks
-- - public.messages
-- - public.conversations
-- - public.conversation_reads
-- - public.contacts
-- - public.student_payment_methods
