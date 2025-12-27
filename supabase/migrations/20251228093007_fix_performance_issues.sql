-- Migration: Fix Performance Issues
-- Description:
--   1. Remove duplicate permissive RLS policies (keep newer consolidated ones)
--   2. Drop duplicate indices
--   3. Create indexes on unindexed foreign keys
--   4. Fix auth RLS initialization plan issues (already handled by dropping old policies)

-- ========================
-- 1. REMOVE DUPLICATE PERMISSIVE POLICIES
-- ========================
-- Drop old policies that weren't removed during consolidation
-- Keep the newer "ADMINSTAFF full access to {table}" policies

-- Files table
DROP POLICY IF EXISTS "adminstaff_all_files" ON public.files;

-- Topics table
DROP POLICY IF EXISTS "adminstaff_all_topics" ON public.topics;

-- Topics files table
DROP POLICY IF EXISTS "adminstaff_all_topics_files" ON public.topics_files;

-- Stripe webhook events table (has two policies with different names but same logic)
DROP POLICY IF EXISTS "ADMINSTAFF full access to webhook_events" ON public.stripe_webhook_events;
-- Keep: "ADMINSTAFF full access to stripe_webhook_events"

-- ========================
-- 2. DROP DUPLICATE INDICES
-- ========================
-- Drop older index names, keep the newer standardized names

-- classes_staff table
DROP INDEX IF EXISTS public.idx_class_assignments_class_id;
DROP INDEX IF EXISTS public.idx_class_assignments_staff_id;
-- Keep: idx_classes_staff_class_id, idx_classes_staff_staff_id

-- classes_students table
DROP INDEX IF EXISTS public.idx_class_enrollments_class_id;
DROP INDEX IF EXISTS public.idx_class_enrollments_student_id;
-- Keep: idx_classes_students_class_id, idx_classes_students_student_id

-- ========================
-- 3. CREATE INDEXES ON UNINDEXED FOREIGN KEYS
-- ========================
-- Foreign keys without indexes can cause performance issues during
-- foreign key constraint checks and joins

-- classes table
CREATE INDEX IF NOT EXISTS idx_classes_created_by ON public.classes(created_by);

-- classes_staff table
CREATE INDEX IF NOT EXISTS idx_classes_staff_created_by ON public.classes_staff(created_by);

-- classes_students table
CREATE INDEX IF NOT EXISTS idx_classes_students_created_by ON public.classes_students(created_by);

-- conversation_reads table
CREATE INDEX IF NOT EXISTS idx_conversation_reads_last_read_message_id ON public.conversation_reads(last_read_message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_reads_staff_id ON public.conversation_reads(staff_id);

-- conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_created_by_staff_id ON public.conversations(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owned_number_id ON public.conversations(owned_number_id);

-- messages table
CREATE INDEX IF NOT EXISTS idx_messages_created_by_staff_id ON public.messages(created_by_staff_id);

-- parents table
CREATE INDEX IF NOT EXISTS idx_parents_created_by ON public.parents(created_by);
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON public.parents(user_id);

-- sessions_staff table
CREATE INDEX IF NOT EXISTS idx_sessions_staff_planned_absence_logged_by ON public.sessions_staff(planned_absence_logged_by);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_swapped_sessions_staff_id ON public.sessions_staff(swapped_sessions_staff_id);

-- sessions_students table
CREATE INDEX IF NOT EXISTS idx_sessions_students_credited_by ON public.sessions_students(credited_by);
CREATE INDEX IF NOT EXISTS idx_sessions_students_planned_absence_logged_by ON public.sessions_students(planned_absence_logged_by);
CREATE INDEX IF NOT EXISTS idx_sessions_students_rescheduled_sessions_students_id ON public.sessions_students(rescheduled_sessions_students_id);

-- students table
CREATE INDEX IF NOT EXISTS idx_students_created_by ON public.students(created_by);

-- students_subjects table
CREATE INDEX IF NOT EXISTS idx_students_subjects_created_by ON public.students_subjects(created_by);

-- tutor_logs_student_attendance table
CREATE INDEX IF NOT EXISTS idx_tutor_logs_student_attendance_created_by ON public.tutor_logs_student_attendance(created_by);

-- tutor_logs_topics table
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_created_by ON public.tutor_logs_topics(created_by);

-- tutor_logs_topics_files table
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_files_created_by ON public.tutor_logs_topics_files(created_by);

-- tutor_logs_topics_files_students table
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_files_students_created_by ON public.tutor_logs_topics_files_students(created_by);

-- tutor_logs_topics_students table
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_students_created_by ON public.tutor_logs_topics_students(created_by);

-- ========================
-- COMMENTS
-- ========================

COMMENT ON INDEX idx_classes_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_classes_staff_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_classes_students_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_conversation_reads_last_read_message_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_conversation_reads_staff_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_conversations_created_by_staff_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_conversations_owned_number_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_messages_created_by_staff_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_parents_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_parents_user_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_sessions_staff_planned_absence_logged_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_sessions_staff_swapped_sessions_staff_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_sessions_students_credited_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_sessions_students_planned_absence_logged_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_sessions_students_rescheduled_sessions_students_id IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_students_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_students_subjects_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_tutor_logs_student_attendance_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_tutor_logs_topics_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_tutor_logs_topics_files_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_tutor_logs_topics_files_students_created_by IS 'Index on foreign key for performance';
COMMENT ON INDEX idx_tutor_logs_topics_students_created_by IS 'Index on foreign key for performance';

