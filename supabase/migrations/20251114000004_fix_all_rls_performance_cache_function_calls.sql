-- ========================
-- FIX ALL RLS PERFORMANCE: Cache ALL function calls
-- ========================
-- 
-- Problem: All RLS helper functions (is_adminstaff, is_staff, is_tutor, is_student)
-- were being called once PER ROW in queries, causing massive performance issues
--
-- Solution: Wrap ALL function calls in SELECT to cache result once per query
-- 
-- Functions affected:
-- - is_adminstaff_active()
-- - is_adminstaff()
-- - is_staff()
-- - is_tutor()
-- - is_student()
--
-- This migration fixes ALL remaining instances across all tables

-- ========================
-- STUDENTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to students" ON public.students;
CREATE POLICY "ADMINSTAFF full access to students" ON public.students
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to students" ON public.students;
CREATE POLICY "TUTOR read access to students" ON public.students
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Allow read access to all staff" ON students;
CREATE POLICY "Allow read access to all staff" ON students
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "Allow students to read own data" ON students;
CREATE POLICY "Allow students to read own data" ON students
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_student()));

DROP POLICY IF EXISTS "Allow adminstaff to insert" ON students;
CREATE POLICY "Allow adminstaff to insert" ON students
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "Allow adminstaff to update" ON students;
CREATE POLICY "Allow adminstaff to update" ON students
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "Allow adminstaff to delete" ON students;
CREATE POLICY "Allow adminstaff to delete" ON students
  FOR DELETE TO authenticated
  USING ((SELECT public.is_adminstaff()));

-- ========================
-- STAFF TABLE
-- ========================
DROP POLICY IF EXISTS "Allow staff to read staff data" ON staff;
CREATE POLICY "Allow staff to read staff data" ON staff
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "Allow adminstaff to insert staff" ON staff;
CREATE POLICY "Allow adminstaff to insert staff" ON staff
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "Allow adminstaff to update any staff" ON staff;
CREATE POLICY "Allow adminstaff to update any staff" ON staff
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "Allow adminstaff to delete staff" ON staff;
CREATE POLICY "Allow adminstaff to delete staff" ON staff
  FOR DELETE TO authenticated
  USING ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "Allow tutors to update own staff record" ON staff;
CREATE POLICY "Allow tutors to update own staff record" ON staff
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "TUTOR read access to staff" ON public.staff;
CREATE POLICY "TUTOR read access to staff" ON public.staff
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- STAFF_SUBJECTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_subjects" ON public.staff_subjects;
CREATE POLICY "ADMINSTAFF full access to staff_subjects" ON public.staff_subjects
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to staff_subjects" ON public.staff_subjects;
CREATE POLICY "TUTOR read access to staff_subjects" ON public.staff_subjects
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- STUDENTS_SUBJECTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to students_subjects" ON public.students_subjects;
CREATE POLICY "ADMINSTAFF full access to students_subjects" ON public.students_subjects
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to students_subjects" ON public.students_subjects;
CREATE POLICY "TUTOR read access to students_subjects" ON public.students_subjects
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- SUBJECTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to subjects" ON public.subjects;
CREATE POLICY "ADMINSTAFF full access to subjects" ON public.subjects
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to subjects" ON public.subjects;
CREATE POLICY "TUTOR read access to subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- CLASSES TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to classes" ON public.classes;
CREATE POLICY "ADMINSTAFF full access to classes" ON public.classes
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to classes" ON public.classes;
CREATE POLICY "TUTOR read access to classes" ON public.classes
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- CLASSES_STUDENTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to classes_students" ON public.classes_students;
CREATE POLICY "ADMINSTAFF full access to classes_students" ON public.classes_students
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to classes_students" ON public.classes_students;
CREATE POLICY "TUTOR read access to classes_students" ON public.classes_students
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- CLASSES_STAFF TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to classes_staff" ON public.classes_staff;
CREATE POLICY "ADMINSTAFF full access to classes_staff" ON public.classes_staff
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to classes_staff" ON public.classes_staff;
CREATE POLICY "TUTOR read access to classes_staff" ON public.classes_staff
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- TOPICS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to topics" ON public.topics;
CREATE POLICY "ADMINSTAFF full access to topics" ON public.topics
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

DROP POLICY IF EXISTS "TUTOR read access to topics" ON public.topics;
CREATE POLICY "TUTOR read access to topics" ON public.topics
  FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

-- ========================
-- SESSIONS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions" ON public.sessions;
CREATE POLICY "ADMINSTAFF full access to sessions" ON public.sessions
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

-- ========================
-- SESSIONS_STUDENTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_students" ON public.sessions_students;
CREATE POLICY "ADMINSTAFF full access to sessions_students" ON public.sessions_students
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

-- ========================
-- SESSIONS_STAFF TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_staff" ON public.sessions_staff;
CREATE POLICY "ADMINSTAFF full access to sessions_staff" ON public.sessions_staff
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

-- ========================
-- TUTOR_LOGS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs" ON public.tutor_logs;
CREATE POLICY "ADMINSTAFF full access to tutor_logs" ON public.tutor_logs
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff()))
  WITH CHECK ((SELECT public.is_adminstaff()));

-- ========================
-- TUTOR_LOGS_STAFF_ATTENDANCE TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_staff_attendance') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_staff_attendance" ON public.tutor_logs_staff_attendance';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_staff_attendance" ON public.tutor_logs_staff_attendance FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TUTOR_LOGS_STUDENT_ATTENDANCE TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_student_attendance') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_student_attendance" ON public.tutor_logs_student_attendance';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_student_attendance" ON public.tutor_logs_student_attendance FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TUTOR_LOGS_TOPICS TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_topics') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics" ON public.tutor_logs_topics';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics" ON public.tutor_logs_topics FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TUTOR_LOGS_TOPICS_STUDENTS TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_topics_students') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_students" ON public.tutor_logs_topics_students';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_students" ON public.tutor_logs_topics_students FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TUTOR_LOGS_TOPICS_FILES TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_topics_files') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_files" ON public.tutor_logs_topics_files';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_files" ON public.tutor_logs_topics_files FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TUTOR_LOGS_TOPICS_FILES_STUDENTS TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_logs_topics_files_students') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_files_students" ON public.tutor_logs_topics_files_students';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_files_students" ON public.tutor_logs_topics_files_students FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- NOTES TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to notes" ON public.notes';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to notes" ON public.notes FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- FILES TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'files') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to files" ON public.files';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to files" ON public.files FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- TOPICS_FILES TABLE
-- ========================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'topics_files') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to topics_files" ON public.topics_files';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to topics_files" ON public.topics_files FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- BILLING AND PAYMENT TABLES
-- ========================
DO $$ BEGIN
  -- Student billing accounts
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_billing_accounts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to student_billing_accounts" ON public.student_billing_accounts';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to student_billing_accounts" ON public.student_billing_accounts FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Billing cycles
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_cycles') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_cycles" ON public.billing_cycles';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to billing_cycles" ON public.billing_cycles FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Billing runs
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_runs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_runs" ON public.billing_runs';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to billing_runs" ON public.billing_runs FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Billing settings
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_settings" ON public.billing_settings';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to billing_settings" ON public.billing_settings FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Student payment methods
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_payment_methods') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to student_payment_methods" ON public.student_payment_methods';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to student_payment_methods" ON public.student_payment_methods FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Stripe webhook events
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stripe_webhook_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to stripe_webhook_events" ON public.stripe_webhook_events';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to stripe_webhook_events" ON public.stripe_webhook_events FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
  
  -- Payment attempts
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_attempts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "ADMINSTAFF full access to payment_attempts" ON public.payment_attempts';
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to payment_attempts" ON public.payment_attempts FOR ALL TO authenticated USING ((SELECT public.is_adminstaff())) WITH CHECK ((SELECT public.is_adminstaff()))';
  END IF;
END $$;

-- ========================
-- VERIFICATION COMMENT
-- ========================
COMMENT ON DATABASE postgres IS 'RLS performance fix applied: All function calls wrapped in SELECT for caching';

