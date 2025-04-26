-- MIGRATION FOR SCHEMA UPDATES

-- ========================
-- MODIFY STUDENTS TABLE
-- ========================
ALTER TABLE students 
  ADD COLUMN school TEXT,
  ADD COLUMN curriculum TEXT CHECK (curriculum IN ('SACE', 'IB', 'PRESACE', 'PRIMARY')),
  ADD COLUMN year_level INTEGER,
  ADD COLUMN parent_first_name TEXT,
  ADD COLUMN parent_last_name TEXT,
  ADD COLUMN student_phone TEXT,
  ADD COLUMN student_email TEXT,
  ADD COLUMN availability_monday BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_tuesday BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_wednesday BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_thursday BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_friday BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_saturday_am BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_saturday_pm BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_sunday_am BOOLEAN DEFAULT FALSE,
  ADD COLUMN availability_sunday_pm BOOLEAN DEFAULT FALSE,
  ADD COLUMN created_by UUID REFERENCES staff(id);

-- Update existing data
UPDATE students 
SET 
  student_phone = phone_number,
  student_email = email,
  parent_first_name = SPLIT_PART(parent_name, ' ', 1),
  parent_last_name = SUBSTRING(parent_name FROM POSITION(' ' IN parent_name))
WHERE phone_number IS NOT NULL OR email IS NOT NULL OR parent_name IS NOT NULL;

-- Modify student status
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_status_check;
  
ALTER TABLE students
  ADD CONSTRAINT students_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'TRIAL', 'DISCONTINUED'));

UPDATE students SET status = 'ACTIVE' WHERE status = 'CURRENT';

-- Drop old columns
ALTER TABLE students
  DROP COLUMN phone_number,
  DROP COLUMN email,
  DROP COLUMN parent_name;
  
-- ========================
-- CREATE SUBJECTS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  year_level INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);

-- ========================
-- CREATE STUDENTS-SUBJECTS JOIN TABLE
-- ========================
CREATE TABLE IF NOT EXISTS students_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_students_subjects_student_id ON students_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_students_subjects_subject_id ON students_subjects(subject_id);

-- ========================
-- MODIFY STAFF TABLE
-- ========================
ALTER TABLE staff
  ADD COLUMN office_key_number INTEGER,
  ADD COLUMN has_parking_remote TEXT CHECK (has_parking_remote IN ('VIRTUAL', 'PHYSICAL', 'NONE'));

-- Modify staff role
ALTER TABLE staff 
  DROP CONSTRAINT IF EXISTS staff_role_check;
  
ALTER TABLE staff
  ADD CONSTRAINT staff_role_check CHECK (role IN ('ADMINSTAFF', 'TUTOR'));

UPDATE staff SET role = 'ADMINSTAFF' WHERE role = 'ADMIN';

-- ========================
-- CREATE STAFF-SUBJECTS JOIN TABLE
-- ========================
CREATE TABLE IF NOT EXISTS staff_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_subjects_staff_id ON staff_subjects(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_subjects_subject_id ON staff_subjects(subject_id);

-- ========================
-- MODIFY CLASSES TABLE
-- ========================

-- Add subject_id column to classes
ALTER TABLE classes 
  ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  ADD COLUMN room TEXT,
  ADD COLUMN created_by UUID REFERENCES staff(id);

-- Drop max_capacity column
ALTER TABLE classes 
  DROP COLUMN max_capacity;

-- ========================
-- RENAME AND MODIFY CLASS_ENROLLMENTS TO CLASSES_STUDENTS
-- ========================
ALTER TABLE class_enrollments RENAME TO classes_students;

-- Modify status in classes_students
ALTER TABLE classes_students 
  DROP CONSTRAINT IF EXISTS class_enrollments_status_check;
  
ALTER TABLE classes_students
  ADD CONSTRAINT classes_students_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'TRIAL'));

UPDATE classes_students SET status = 'ACTIVE' WHERE status = 'ACTIVE';
UPDATE classes_students SET status = 'INACTIVE' WHERE status = 'DISCONTINUED';

-- Add created_by column
ALTER TABLE classes_students
  ADD COLUMN created_by UUID REFERENCES staff(id);

-- ========================
-- RENAME AND MODIFY CLASS_ASSIGNMENTS TO CLASSES_STAFF
-- ========================
ALTER TABLE class_assignments RENAME TO classes_staff;

-- Drop is_substitute column and add status
ALTER TABLE classes_staff
  DROP COLUMN is_substitute,
  ADD COLUMN status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
  ADD COLUMN created_by UUID REFERENCES staff(id);

-- ========================
-- MODIFY ABSENCES TABLE
-- ========================
ALTER TABLE absences
  ADD COLUMN missed_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN rescheduled_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN created_by UUID REFERENCES staff(id);

-- Update any existing data - can't automatically map old text dates to session IDs
UPDATE absences SET rescheduled_session_id = NULL;

-- Drop old columns
ALTER TABLE absences
  DROP COLUMN rescheduled_date;

-- ========================
-- DROP UNUSED TABLES
-- ========================
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS drafting_sessions;
DROP TABLE IF EXISTS shift_swaps;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS files;

-- ========================
-- MODIFY SESSIONS TABLE
-- ========================
ALTER TABLE sessions
  ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN start_time TEXT,
  ADD COLUMN end_time TEXT;

-- Modify type check constraint
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_type_check;
  
ALTER TABLE sessions
  ADD CONSTRAINT sessions_type_check CHECK (type IN ('CLASS', 'DRAFTING', 'SUBSIDY_INTERVIEW', 'TRIAL_SESSION', 'STAFF_INTERVIEW'));

-- Drop columns
ALTER TABLE sessions
  DROP COLUMN staff_id,
  DROP COLUMN teaching_content;

-- ========================
-- RENAME SESSION_ATTENDANCES TO SESSIONS_STUDENTS
-- ========================
ALTER TABLE session_attendances RENAME TO sessions_students;

-- ========================
-- CREATE SESSIONS_STAFF TABLE
-- ========================
CREATE TABLE IF NOT EXISTS sessions_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_staff_session_id ON sessions_staff(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_staff_id ON sessions_staff(staff_id);

-- ========================
-- CREATE TOPICS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, number)
);

CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);

-- ========================
-- CREATE SUBTOPICS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS subtopics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic_id, number)
);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);

-- ========================
-- CREATE RESOURCE_FILES TABLE
-- ========================
CREATE TYPE resource_type AS ENUM (
  'NOTES', 'TEST', 'PRACTICE_QUESTIONS', 'VIDEO', 'EXAM', 'FLASHCARDS', 'REVISION_SHEET', 'CHEAT_SHEET'
);

CREATE TYPE resource_answers AS ENUM ('BLANK', 'ANSWERS');

CREATE TABLE IF NOT EXISTS resource_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE CASCADE,
  type resource_type NOT NULL,
  answers resource_answers NOT NULL DEFAULT 'BLANK',
  number INTEGER,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (topic_id IS NOT NULL AND subtopic_id IS NULL) OR
    (topic_id IS NULL AND subtopic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_resource_files_topic_id ON resource_files(topic_id);
CREATE INDEX IF NOT EXISTS idx_resource_files_subtopic_id ON resource_files(subtopic_id);

-- ========================
-- CREATE SESSIONS_RESOURCE_FILES JOIN TABLE
-- ========================
CREATE TABLE IF NOT EXISTS sessions_resource_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  resource_file_id UUID NOT NULL REFERENCES resource_files(id) ON DELETE CASCADE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, resource_file_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_resource_files_session_id ON sessions_resource_files(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_resource_files_resource_file_id ON sessions_resource_files(resource_file_id);

-- ========================
-- UPDATE EXISTING AUDIT LOGS
-- ========================
-- Student audit logs already exist
-- Staff audit logs already exist
-- Class audit logs already exist
-- Create session audit logs

CREATE TABLE IF NOT EXISTS session_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'OTHER')),
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_audit_logs_session_id ON session_audit_logs(session_id);

-- ========================
-- UPDATE TRIGGERS
-- ========================
-- Create triggers for update_updated_at for new tables
CREATE TRIGGER set_updated_at_subjects
BEFORE UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_students_subjects
BEFORE UPDATE ON students_subjects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_staff_subjects
BEFORE UPDATE ON staff_subjects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sessions_staff
BEFORE UPDATE ON sessions_staff
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_topics
BEFORE UPDATE ON topics
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_subtopics
BEFORE UPDATE ON subtopics
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_resource_files
BEFORE UPDATE ON resource_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sessions_resource_files
BEFORE UPDATE ON sessions_resource_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Rename triggers for renamed tables
ALTER TRIGGER set_updated_at_class_enrollments ON classes_students
RENAME TO set_updated_at_classes_students;

ALTER TRIGGER set_updated_at_class_assignments ON classes_staff
RENAME TO set_updated_at_classes_staff;

ALTER TRIGGER set_updated_at_session_attendances ON sessions_students
RENAME TO set_updated_at_sessions_students;

-- ========================
-- UPDATE RLS POLICIES
-- ========================

-- Enable RLS on new tables
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for read access
CREATE POLICY "Allow authenticated read access" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON students_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON staff_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON sessions_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON subtopics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON resource_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON sessions_resource_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON session_audit_logs FOR SELECT TO authenticated USING (true);

-- Create policies for Admin write access
CREATE POLICY "Allow admin insert" ON subjects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);
CREATE POLICY "Allow admin update" ON subjects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);
CREATE POLICY "Allow admin delete" ON subjects FOR DELETE USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

-- Similar policies for other tables
CREATE POLICY "Allow admin insert" ON students_subjects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

CREATE POLICY "Allow admin insert" ON staff_subjects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

CREATE POLICY "Allow admin insert" ON topics FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

CREATE POLICY "Allow admin insert" ON subtopics FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

CREATE POLICY "Allow admin insert" ON resource_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF')
);

-- Allow both ADMINSTAFF and TUTOR to add entries to sessions_resource_files
CREATE POLICY "Allow staff insert" ON sessions_resource_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
);

-- ========================
-- FINALIZE
-- ========================
-- This migration modifies the schema according to the requirements 