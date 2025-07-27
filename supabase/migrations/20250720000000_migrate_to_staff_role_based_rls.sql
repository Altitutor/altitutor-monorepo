-- Migration: Migrate to Staff Role-Based RLS
-- Description: Remove all JWT claim-based RLS policies and replace with staff table role-based policies
-- Permissions:
--   - ADMINSTAFF: view and edit all tables
--   - TUTOR: view all tables, edit/delete nothing
-- Future: Will support students viewing their own records, classes, and tutors

-- ========================
-- DROP ALL EXISTING RLS POLICIES
-- ========================

-- Drop policies for students table
DROP POLICY IF EXISTS "Allow read access to all staff" ON public.students;
DROP POLICY IF EXISTS "Allow students to read own data" ON public.students;
DROP POLICY IF EXISTS "Allow adminstaff to insert" ON public.students;
DROP POLICY IF EXISTS "Allow adminstaff to insert students" ON public.students;
DROP POLICY IF EXISTS "Allow adminstaff to update" ON public.students;
DROP POLICY IF EXISTS "Allow adminstaff to delete" ON public.students;
DROP POLICY IF EXISTS "Allow admin insert" ON public.students;
DROP POLICY IF EXISTS "Allow admin update" ON public.students;
DROP POLICY IF EXISTS "Allow admin delete" ON public.students;
DROP POLICY IF EXISTS "Allow tutors to read assigned students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.students;

-- Drop policies for staff table
DROP POLICY IF EXISTS "Allow staff to read staff data" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to update any staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to update staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to delete staff" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to update own staff record" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to update own record" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff full staff access" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to read own record" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to read all staff" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can read all staff" ON public.staff;
DROP POLICY IF EXISTS "TUTOR can read own record" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can insert staff" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can update staff" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can delete staff" ON public.staff;
DROP POLICY IF EXISTS "TUTOR can update own record" ON public.staff;
DROP POLICY IF EXISTS "Allow staff to read own record" ON public.staff;
DROP POLICY IF EXISTS "Allow authenticated users to read staff" ON public.staff;

-- Drop policies for classes table
DROP POLICY IF EXISTS "Allow staff to read classes" ON public.classes;
DROP POLICY IF EXISTS "Allow adminstaff to write classes" ON public.classes;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.classes;
DROP POLICY IF EXISTS "Allow admin write access" ON public.classes;

-- Drop policies for classes_students table
DROP POLICY IF EXISTS "Allow staff to read classes_students" ON public.classes_students;
DROP POLICY IF EXISTS "Allow adminstaff to write classes_students" ON public.classes_students;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.classes_students;
DROP POLICY IF EXISTS "Allow admin write access" ON public.classes_students;

-- Drop policies for classes_staff table
DROP POLICY IF EXISTS "Allow staff to read classes_staff" ON public.classes_staff;
DROP POLICY IF EXISTS "Allow adminstaff to write classes_staff" ON public.classes_staff;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.classes_staff;
DROP POLICY IF EXISTS "Allow admin write access" ON public.classes_staff;

-- Drop policies for sessions table
DROP POLICY IF EXISTS "Allow staff to read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow adminstaff to write sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.sessions;
DROP POLICY IF EXISTS "Allow admin write access" ON public.sessions;

-- Drop policies for sessions_students table
DROP POLICY IF EXISTS "Allow staff to read sessions_students" ON public.sessions_students;
DROP POLICY IF EXISTS "Allow adminstaff to write sessions_students" ON public.sessions_students;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.sessions_students;
DROP POLICY IF EXISTS "Allow admin write access" ON public.sessions_students;

-- Drop policies for sessions_staff table
DROP POLICY IF EXISTS "Allow staff to read sessions_staff" ON public.sessions_staff;
DROP POLICY IF EXISTS "Allow adminstaff to write sessions_staff" ON public.sessions_staff;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.sessions_staff;
DROP POLICY IF EXISTS "Allow admin write access" ON public.sessions_staff;

-- Drop policies for subjects table
DROP POLICY IF EXISTS "Allow staff to read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow adminstaff to write subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow role-based subject access" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON public.subjects;
DROP POLICY IF EXISTS "Allow admin update" ON public.subjects;
DROP POLICY IF EXISTS "Allow admin delete" ON public.subjects;
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;

-- Drop policies for students_subjects table
DROP POLICY IF EXISTS "Allow staff to read students_subjects" ON public.students_subjects;
DROP POLICY IF EXISTS "Allow adminstaff to write students_subjects" ON public.students_subjects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.students_subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON public.students_subjects;

-- Drop policies for staff_subjects table
DROP POLICY IF EXISTS "Allow staff to read staff_subjects" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow adminstaff to insert staff_subjects" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow adminstaff to update staff_subjects" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow adminstaff to delete staff_subjects" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow tutors to update their own staff_subjects" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.staff_subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON public.staff_subjects;

-- Drop policies for topics table
DROP POLICY IF EXISTS "Allow staff to read topics" ON public.topics;
DROP POLICY IF EXISTS "Allow adminstaff to write topics" ON public.topics;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.topics;
DROP POLICY IF EXISTS "Allow admin insert" ON public.topics;

-- Drop policies for subtopics table
DROP POLICY IF EXISTS "Allow staff to read subtopics" ON public.subtopics;
DROP POLICY IF EXISTS "Allow adminstaff to write subtopics" ON public.subtopics;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.subtopics;
DROP POLICY IF EXISTS "Allow admin insert" ON public.subtopics;

-- Drop policies for resource_files table
DROP POLICY IF EXISTS "Allow staff to read resource_files" ON public.resource_files;
DROP POLICY IF EXISTS "Allow adminstaff to write resource_files" ON public.resource_files;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.resource_files;
DROP POLICY IF EXISTS "Allow admin insert" ON public.resource_files;

-- Drop policies for sessions_resource_files table
DROP POLICY IF EXISTS "Allow staff to read sessions_resource_files" ON public.sessions_resource_files;
DROP POLICY IF EXISTS "Allow staff to insert sessions_resource_files" ON public.sessions_resource_files;
DROP POLICY IF EXISTS "Allow staff to update sessions_resource_files" ON public.sessions_resource_files;
DROP POLICY IF EXISTS "Allow adminstaff to delete sessions_resource_files" ON public.sessions_resource_files;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.sessions_resource_files;
DROP POLICY IF EXISTS "Allow staff insert" ON public.sessions_resource_files;

-- Drop policies for absences table
DROP POLICY IF EXISTS "Allow staff to read absences" ON public.absences;
DROP POLICY IF EXISTS "Allow adminstaff to write absences" ON public.absences;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.absences;
DROP POLICY IF EXISTS "Allow admin write access" ON public.absences;

-- Drop policies for audit log tables
DROP POLICY IF EXISTS "Allow staff to read student_audit_logs" ON public.student_audit_logs;
DROP POLICY IF EXISTS "Allow adminstaff to write student_audit_logs" ON public.student_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.student_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON public.student_audit_logs;

DROP POLICY IF EXISTS "Allow staff to read staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Allow adminstaff to write staff_audit_logs" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.staff_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON public.staff_audit_logs;

DROP POLICY IF EXISTS "Allow staff to read classes_audit_logs" ON public.classes_audit_logs;
DROP POLICY IF EXISTS "Allow adminstaff to write classes_audit_logs" ON public.classes_audit_logs;
DROP POLICY IF EXISTS "Allow staff to read class_audit_logs" ON public.classes_audit_logs;
DROP POLICY IF EXISTS "Allow adminstaff to write class_audit_logs" ON public.classes_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.classes_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON public.classes_audit_logs;

DROP POLICY IF EXISTS "Allow staff to read session_audit_logs" ON public.session_audit_logs;
DROP POLICY IF EXISTS "Allow adminstaff to write session_audit_logs" ON public.session_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.session_audit_logs;

-- ========================
-- DROP JWT-RELATED HELPER FUNCTIONS
-- ========================

-- Drop all auth helper functions that rely on JWT claims
DROP FUNCTION IF EXISTS auth.user_role();
DROP FUNCTION IF EXISTS auth.is_adminstaff();
DROP FUNCTION IF EXISTS auth.is_tutor();
DROP FUNCTION IF EXISTS auth.is_student();
DROP FUNCTION IF EXISTS auth.is_staff();
DROP FUNCTION IF EXISTS auth.current_staff_id();
DROP FUNCTION IF EXISTS auth.current_student_id();

-- Drop user role claim management functions
DROP FUNCTION IF EXISTS set_claim(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop trigger that enforces user_role
DROP TRIGGER IF EXISTS enforce_user_role_on_signup ON auth.users;

-- ========================
-- CREATE NEW STAFF ROLE-BASED POLICIES
-- ========================

-- Helper function to check if current user is ADMINSTAFF (using staff table)
CREATE OR REPLACE FUNCTION public.is_adminstaff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE user_id = auth.uid() AND role = 'ADMINSTAFF'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if current user is TUTOR (using staff table)
CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE user_id = auth.uid() AND role = 'TUTOR'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if current user is staff (ADMINSTAFF or TUTOR)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE user_id = auth.uid() AND role IN ('ADMINSTAFF', 'TUTOR')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to get current staff ID
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID AS $$
  SELECT id FROM public.staff WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ========================
-- STUDENTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with students
CREATE POLICY "ADMINSTAFF full access to students" ON public.students
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all students (they need to see student information for teaching)
CREATE POLICY "TUTOR read access to students" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- STAFF TABLE POLICIES (SPECIAL HANDLING)
-- ========================
-- Note: We need to be careful here to avoid circular dependencies
-- Since our helper functions query the staff table, we can't use them for staff table policies

-- ADMINSTAFF can do everything with staff (direct query to avoid circular dependency)
CREATE POLICY "ADMINSTAFF full access to staff" ON public.staff
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff current_user_staff
      WHERE current_user_staff.user_id = auth.uid() 
        AND current_user_staff.role = 'ADMINSTAFF'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff current_user_staff
      WHERE current_user_staff.user_id = auth.uid() 
        AND current_user_staff.role = 'ADMINSTAFF'
    )
  );

-- TUTORS can view all staff (direct query to avoid circular dependency)
CREATE POLICY "TUTOR read access to staff" ON public.staff
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff current_user_staff
      WHERE current_user_staff.user_id = auth.uid() 
        AND current_user_staff.role = 'TUTOR'
    )
  );

-- ========================
-- CLASSES TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with classes
CREATE POLICY "ADMINSTAFF full access to classes" ON public.classes
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all classes
CREATE POLICY "TUTOR read access to classes" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- CLASSES_STUDENTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with classes_students
CREATE POLICY "ADMINSTAFF full access to classes_students" ON public.classes_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all classes_students
CREATE POLICY "TUTOR read access to classes_students" ON public.classes_students
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- CLASSES_STAFF TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with classes_staff
CREATE POLICY "ADMINSTAFF full access to classes_staff" ON public.classes_staff
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all classes_staff
CREATE POLICY "TUTOR read access to classes_staff" ON public.classes_staff
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SESSIONS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with sessions
CREATE POLICY "ADMINSTAFF full access to sessions" ON public.sessions
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all sessions
CREATE POLICY "TUTOR read access to sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SESSIONS_STUDENTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with sessions_students
CREATE POLICY "ADMINSTAFF full access to sessions_students" ON public.sessions_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all sessions_students
CREATE POLICY "TUTOR read access to sessions_students" ON public.sessions_students
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SESSIONS_STAFF TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with sessions_staff
CREATE POLICY "ADMINSTAFF full access to sessions_staff" ON public.sessions_staff
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all sessions_staff
CREATE POLICY "TUTOR read access to sessions_staff" ON public.sessions_staff
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SUBJECTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with subjects
CREATE POLICY "ADMINSTAFF full access to subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all subjects
CREATE POLICY "TUTOR read access to subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- STUDENTS_SUBJECTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with students_subjects
CREATE POLICY "ADMINSTAFF full access to students_subjects" ON public.students_subjects
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all students_subjects
CREATE POLICY "TUTOR read access to students_subjects" ON public.students_subjects
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- STAFF_SUBJECTS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with staff_subjects
CREATE POLICY "ADMINSTAFF full access to staff_subjects" ON public.staff_subjects
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all staff_subjects
CREATE POLICY "TUTOR read access to staff_subjects" ON public.staff_subjects
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- TOPICS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with topics
CREATE POLICY "ADMINSTAFF full access to topics" ON public.topics
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all topics
CREATE POLICY "TUTOR read access to topics" ON public.topics
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SUBTOPICS TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with subtopics
CREATE POLICY "ADMINSTAFF full access to subtopics" ON public.subtopics
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all subtopics
CREATE POLICY "TUTOR read access to subtopics" ON public.subtopics
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- RESOURCE_FILES TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with resource_files
CREATE POLICY "ADMINSTAFF full access to resource_files" ON public.resource_files
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all resource_files
CREATE POLICY "TUTOR read access to resource_files" ON public.resource_files
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- SESSIONS_RESOURCE_FILES TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with sessions_resource_files
CREATE POLICY "ADMINSTAFF full access to sessions_resource_files" ON public.sessions_resource_files
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all sessions_resource_files
CREATE POLICY "TUTOR read access to sessions_resource_files" ON public.sessions_resource_files
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- ABSENCES TABLE POLICIES
-- ========================

-- ADMINSTAFF can do everything with absences
CREATE POLICY "ADMINSTAFF full access to absences" ON public.absences
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all absences
CREATE POLICY "TUTOR read access to absences" ON public.absences
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- AUDIT LOG TABLE POLICIES
-- ========================

-- STUDENT_AUDIT_LOGS
-- ADMINSTAFF can do everything with student_audit_logs
CREATE POLICY "ADMINSTAFF full access to student_audit_logs" ON public.student_audit_logs
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all student_audit_logs
CREATE POLICY "TUTOR read access to student_audit_logs" ON public.student_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- STAFF_AUDIT_LOGS
-- ADMINSTAFF can do everything with staff_audit_logs
CREATE POLICY "ADMINSTAFF full access to staff_audit_logs" ON public.staff_audit_logs
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all staff_audit_logs
CREATE POLICY "TUTOR read access to staff_audit_logs" ON public.staff_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- CLASSES_AUDIT_LOGS
-- ADMINSTAFF can do everything with classes_audit_logs
CREATE POLICY "ADMINSTAFF full access to classes_audit_logs" ON public.classes_audit_logs
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all classes_audit_logs
CREATE POLICY "TUTOR read access to classes_audit_logs" ON public.classes_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- SESSION_AUDIT_LOGS
-- ADMINSTAFF can do everything with session_audit_logs
CREATE POLICY "ADMINSTAFF full access to session_audit_logs" ON public.session_audit_logs
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

-- TUTORS can view all session_audit_logs
CREATE POLICY "TUTOR read access to session_audit_logs" ON public.session_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_tutor());

-- ========================
-- COMMENTS FOR FUTURE STUDENT ACCESS
-- ========================

-- When student access is added later, you can add policies like:
-- 
-- For students table:
-- CREATE POLICY "STUDENT can view own record" ON public.students
--   FOR SELECT TO authenticated
--   USING (user_id = auth.uid());
--
-- For classes_students table (to see their own classes):
-- CREATE POLICY "STUDENT can view own classes" ON public.classes_students
--   FOR SELECT TO authenticated
--   USING (
--     student_id IN (
--       SELECT id FROM public.students WHERE user_id = auth.uid()
--     )
--   );
--
-- For classes table (to see details of classes they're enrolled in):
-- CREATE POLICY "STUDENT can view enrolled classes" ON public.classes
--   FOR SELECT TO authenticated
--   USING (
--     id IN (
--       SELECT class_id FROM public.classes_students cs
--       JOIN public.students s ON s.id = cs.student_id
--       WHERE s.user_id = auth.uid()
--     )
--   );
--
-- For classes_staff table (to see tutors of their classes):
-- CREATE POLICY "STUDENT can view tutors of enrolled classes" ON public.classes_staff
--   FOR SELECT TO authenticated
--   USING (
--     class_id IN (
--       SELECT class_id FROM public.classes_students cs
--       JOIN public.students s ON s.id = cs.student_id
--       WHERE s.user_id = auth.uid()
--     )
--   );

-- ========================
-- FINALIZE
-- ========================

-- Add comments to document the migration
COMMENT ON FUNCTION public.is_adminstaff() IS 'Checks if current user is ADMINSTAFF based on staff table role';
COMMENT ON FUNCTION public.is_tutor() IS 'Checks if current user is TUTOR based on staff table role';
COMMENT ON FUNCTION public.is_staff() IS 'Checks if current user is staff (ADMINSTAFF or TUTOR) based on staff table role';
COMMENT ON FUNCTION public.current_staff_id() IS 'Returns the staff ID for the current user';

-- This migration successfully transitions from JWT claim-based RLS to staff table role-based RLS
-- All policies now use the staff table role directly for authorization
-- ADMINSTAFF: full access to all tables (read, insert, update, delete)
-- TUTOR: read-only access to all tables
-- Future student policies can be added without affecting existing staff policies 