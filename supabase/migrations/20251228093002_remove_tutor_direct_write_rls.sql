-- Migration: Remove tutor direct write RLS policies
-- Description:
--  Remove RLS policies that allow tutors direct write access to tutor_logs tables.
--  Tutors should write through API routes only (which use service role client).
--  Tutors can read through vtutor_tutor_log view, so we remove read policies too.

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can view their own tutor logs" ON public.tutor_logs;
DROP POLICY IF EXISTS "Tutors can insert their own tutor logs" ON public.tutor_logs;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_STAFF_ATTENDANCE TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access staff attendance for their logs" ON public.tutor_logs_staff_attendance;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_STUDENT_ATTENDANCE TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access student attendance for their logs" ON public.tutor_logs_student_attendance;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_TOPICS TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access topics for their logs" ON public.tutor_logs_topics;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_TOPICS_STUDENTS TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access topic students for their logs" ON public.tutor_logs_topics_students;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_TOPICS_FILES TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access topic files for their logs" ON public.tutor_logs_topics_files;

-- ================================================
-- REMOVE TUTOR RLS POLICIES ON TUTOR_LOGS_TOPICS_FILES_STUDENTS TABLE
-- ================================================

DROP POLICY IF EXISTS "Tutors can access topic file students for their logs" ON public.tutor_logs_topics_files_students;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.tutor_logs IS 'Tutor logs table - only ADMINSTAFF can access directly. Tutors read via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_staff_attendance IS 'Tutor log staff attendance - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_student_attendance IS 'Tutor log student attendance - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_topics IS 'Tutor log topics - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_topics_students IS 'Tutor log topic students - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_topics_files IS 'Tutor log topic files - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';
COMMENT ON TABLE public.tutor_logs_topics_files_students IS 'Tutor log topic file students - only ADMINSTAFF can access directly. Tutors access via vtutor_tutor_log view and write via API routes.';

