-- MIGRATION FOR CUSTOM CLAIMS-BASED RLS
-- This migration updates our RLS policies to use custom claims (user_role) instead of checking the staff table
-- Roles defined in custom claims: 'ADMINSTAFF', 'TUTOR', 'STUDENT'

-- ========================
-- UPDATE STUDENTS TABLE
-- ========================

-- Make user_id NOT NULL for students
ALTER TABLE students 
  ALTER COLUMN user_id SET NOT NULL;

-- ========================
-- CREATE HELPER FUNCTIONS
-- ========================

-- Create function to check user role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_role',
    'student'
  )::TEXT;
$$ LANGUAGE sql STABLE;

-- Create function to check if user is ADMINSTAFF
CREATE OR REPLACE FUNCTION auth.is_adminstaff()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'ADMINSTAFF';
$$ LANGUAGE sql STABLE;

-- Create function to check if user is TUTOR
CREATE OR REPLACE FUNCTION auth.is_tutor()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'TUTOR';
$$ LANGUAGE sql STABLE;

-- Create function to check if user is STUDENT
CREATE OR REPLACE FUNCTION auth.is_student()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'STUDENT';
$$ LANGUAGE sql STABLE;

-- Create function to check if user is staff (either ADMINSTAFF or TUTOR)
CREATE OR REPLACE FUNCTION auth.is_staff()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() IN ('ADMINSTAFF', 'TUTOR');
$$ LANGUAGE sql STABLE;

-- Create function to get the staff ID for the current user
CREATE OR REPLACE FUNCTION auth.current_staff_id()
RETURNS UUID AS $$
  SELECT id FROM staff WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Create function to get the student ID for the current user
CREATE OR REPLACE FUNCTION auth.current_student_id()
RETURNS UUID AS $$
  SELECT id FROM students WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- ========================
-- UPDATE RLS POLICIES
-- ========================

-- Update RLS policies for all tables to use custom claims

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow admin insert" ON students;
DROP POLICY IF EXISTS "Allow admin update" ON students;
DROP POLICY IF EXISTS "Allow admin delete" ON students;
DROP POLICY IF EXISTS "Allow authenticated read access" ON students;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON students;

-- Students table policies
CREATE POLICY "Allow read access to all staff" ON students
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow students to read own data" ON students
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND auth.is_student());

CREATE POLICY "Allow adminstaff to insert" ON students
  FOR INSERT TO authenticated
  WITH CHECK (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to update" ON students
  FOR UPDATE TO authenticated
  USING (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to delete" ON students
  FOR DELETE TO authenticated
  USING (auth.is_adminstaff());

-- Staff table policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON staff;
DROP POLICY IF EXISTS "Allow admin write access" ON staff;

CREATE POLICY "Allow staff to read staff data" ON staff
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to insert staff" ON staff
  FOR INSERT TO authenticated
  WITH CHECK (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to update any staff" ON staff
  FOR UPDATE TO authenticated
  USING (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to delete staff" ON staff
  FOR DELETE TO authenticated
  USING (auth.is_adminstaff());

CREATE POLICY "Allow tutors to update own staff record" ON staff
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND auth.is_tutor());

-- Staff subjects policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON staff_subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON staff_subjects;

CREATE POLICY "Allow staff to read staff_subjects" ON staff_subjects
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to insert staff_subjects" ON staff_subjects
  FOR INSERT TO authenticated
  WITH CHECK (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to update staff_subjects" ON staff_subjects
  FOR UPDATE TO authenticated
  USING (auth.is_adminstaff());

CREATE POLICY "Allow adminstaff to delete staff_subjects" ON staff_subjects
  FOR DELETE TO authenticated
  USING (auth.is_adminstaff());

CREATE POLICY "Allow tutors to update their own staff_subjects" ON staff_subjects
  FOR UPDATE TO authenticated
  USING (staff_id = auth.current_staff_id() AND auth.is_tutor());

-- Sessions resource files policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON sessions_resource_files;
DROP POLICY IF EXISTS "Allow staff insert" ON sessions_resource_files;

CREATE POLICY "Allow staff to read sessions_resource_files" ON sessions_resource_files
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow staff to insert sessions_resource_files" ON sessions_resource_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.is_staff());

CREATE POLICY "Allow staff to update sessions_resource_files" ON sessions_resource_files
  FOR UPDATE TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to delete sessions_resource_files" ON sessions_resource_files
  FOR DELETE TO authenticated
  USING (auth.is_adminstaff());

-- Update all other tables with generic policies
-- Classes table
DROP POLICY IF EXISTS "Allow authenticated read access" ON classes;
DROP POLICY IF EXISTS "Allow admin write access" ON classes;

CREATE POLICY "Allow staff to read classes" ON classes
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write classes" ON classes
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Classes students (formerly class_enrollments)
DROP POLICY IF EXISTS "Allow authenticated read access" ON classes_students;
DROP POLICY IF EXISTS "Allow admin write access" ON classes_students;

CREATE POLICY "Allow staff to read classes_students" ON classes_students
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write classes_students" ON classes_students
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Classes staff (formerly class_assignments)
DROP POLICY IF EXISTS "Allow authenticated read access" ON classes_staff;
DROP POLICY IF EXISTS "Allow admin write access" ON classes_staff;

CREATE POLICY "Allow staff to read classes_staff" ON classes_staff
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write classes_staff" ON classes_staff
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Absences
DROP POLICY IF EXISTS "Allow authenticated read access" ON absences;
DROP POLICY IF EXISTS "Allow admin write access" ON absences;

CREATE POLICY "Allow staff to read absences" ON absences
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write absences" ON absences
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Sessions
DROP POLICY IF EXISTS "Allow authenticated read access" ON sessions;
DROP POLICY IF EXISTS "Allow admin write access" ON sessions;

CREATE POLICY "Allow staff to read sessions" ON sessions
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write sessions" ON sessions
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Sessions students (formerly session_attendances)
DROP POLICY IF EXISTS "Allow authenticated read access" ON sessions_students;
DROP POLICY IF EXISTS "Allow admin write access" ON sessions_students;

CREATE POLICY "Allow staff to read sessions_students" ON sessions_students
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write sessions_students" ON sessions_students
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Sessions staff
DROP POLICY IF EXISTS "Allow authenticated read access" ON sessions_staff;

CREATE POLICY "Allow staff to read sessions_staff" ON sessions_staff
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write sessions_staff" ON sessions_staff
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Subjects
DROP POLICY IF EXISTS "Allow authenticated read access" ON subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON subjects;
DROP POLICY IF EXISTS "Allow admin update" ON subjects;
DROP POLICY IF EXISTS "Allow admin delete" ON subjects;

CREATE POLICY "Allow staff to read subjects" ON subjects
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write subjects" ON subjects
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Students subjects
DROP POLICY IF EXISTS "Allow authenticated read access" ON students_subjects;
DROP POLICY IF EXISTS "Allow admin insert" ON students_subjects;

CREATE POLICY "Allow staff to read students_subjects" ON students_subjects
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write students_subjects" ON students_subjects
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Topics
DROP POLICY IF EXISTS "Allow authenticated read access" ON topics;
DROP POLICY IF EXISTS "Allow admin insert" ON topics;

CREATE POLICY "Allow staff to read topics" ON topics
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write topics" ON topics
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Subtopics
DROP POLICY IF EXISTS "Allow authenticated read access" ON subtopics;
DROP POLICY IF EXISTS "Allow admin insert" ON subtopics;

CREATE POLICY "Allow staff to read subtopics" ON subtopics
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write subtopics" ON subtopics
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Resource files
DROP POLICY IF EXISTS "Allow authenticated read access" ON resource_files;
DROP POLICY IF EXISTS "Allow admin insert" ON resource_files;

CREATE POLICY "Allow staff to read resource_files" ON resource_files
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write resource_files" ON resource_files
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- Audit logs tables
DROP POLICY IF EXISTS "Allow authenticated read access" ON student_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON student_audit_logs;

CREATE POLICY "Allow staff to read student_audit_logs" ON student_audit_logs
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write student_audit_logs" ON student_audit_logs
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

DROP POLICY IF EXISTS "Allow authenticated read access" ON staff_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON staff_audit_logs;

CREATE POLICY "Allow staff to read staff_audit_logs" ON staff_audit_logs
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write staff_audit_logs" ON staff_audit_logs
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

DROP POLICY IF EXISTS "Allow authenticated read access" ON class_audit_logs;
DROP POLICY IF EXISTS "Allow admin write access" ON class_audit_logs;

CREATE POLICY "Allow staff to read class_audit_logs" ON class_audit_logs
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write class_audit_logs" ON class_audit_logs
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

DROP POLICY IF EXISTS "Allow authenticated read access" ON session_audit_logs;

CREATE POLICY "Allow staff to read session_audit_logs" ON session_audit_logs
  FOR SELECT TO authenticated
  USING (auth.is_staff());

CREATE POLICY "Allow adminstaff to write session_audit_logs" ON session_audit_logs
  FOR ALL TO authenticated
  USING (auth.is_adminstaff())
  WITH CHECK (auth.is_adminstaff());

-- ========================
-- FINALIZE
-- ========================
-- This migration updates RLS policies to use custom claims instead of checking the staff table 