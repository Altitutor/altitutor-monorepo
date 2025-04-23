-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('CURRENT', 'INACTIVE', 'TRIAL', 'DISCONTINUED')),
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TUTOR')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'TRIAL')),
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY,
  subject TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'FULL')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISCONTINUED', 'TRIAL')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id, start_date)
);

-- Class assignments table
CREATE TABLE IF NOT EXISTS class_assignments (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, class_id, start_date)
);

-- Absences table
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PLANNED', 'UNPLANNED')),
  reason TEXT,
  is_rescheduled BOOLEAN NOT NULL DEFAULT FALSE,
  rescheduled_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TRIAL_SESSION', 'SUBSIDY_INTERVIEW', 'PARENT_MEETING', 'OTHER')),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drafting sessions table
CREATE TABLE IF NOT EXISTS drafting_sessions (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ENGLISH', 'ASSIGNMENT')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shift swaps table
CREATE TABLE IF NOT EXISTS shift_swaps (
  id UUID PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
  substitute_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CLASS', 'DRAFTING', 'SUBSIDY_INTERVIEW', 'TRIAL_SESSION', 'TRIAL_SHIFT')),
  subject TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  teaching_content TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session attendances table
CREATE TABLE IF NOT EXISTS session_attendances (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('EMAIL', 'SMS', 'INTERNAL_NOTE')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'SENT', 'FAILED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DOCUMENT', 'IMAGE', 'OTHER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student audit logs table
CREATE TABLE IF NOT EXISTS student_audit_logs (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'ENROLLMENT_CHANGED', 'OTHER')),
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff audit logs table
CREATE TABLE IF NOT EXISTS staff_audit_logs (
  id UUID PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'ASSIGNMENT_CHANGED', 'OTHER')),
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class audit logs table
CREATE TABLE IF NOT EXISTS class_audit_logs (
  id UUID PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'OTHER')),
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_classes_subject ON classes(subject);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_staff_id ON class_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_class_id ON class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_absences_student_id ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
CREATE INDEX IF NOT EXISTS idx_meetings_student_id ON meetings(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_id ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_session_attendances_session_id ON session_attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendances_student_id ON session_attendances(student_id);

-- Create Row Level Security (RLS) policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create default policies for authenticated users
CREATE POLICY "Allow authenticated read access" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON class_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON class_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON absences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON drafting_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON shift_swaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON session_attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON student_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON staff_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON class_audit_logs FOR SELECT TO authenticated USING (true);

-- Create policies for write operations (staff with ADMIN role only)
CREATE POLICY "Allow admin write access" ON students FOR INSERT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Allow admin write access" ON students FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Allow admin write access" ON students FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- Add more policies for other tables as needed

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update timestamps
CREATE TRIGGER set_updated_at_students
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_staff
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_classes
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_class_enrollments
BEFORE UPDATE ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_class_assignments
BEFORE UPDATE ON class_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_absences
BEFORE UPDATE ON absences
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_meetings
BEFORE UPDATE ON meetings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_drafting_sessions
BEFORE UPDATE ON drafting_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_shift_swaps
BEFORE UPDATE ON shift_swaps
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sessions
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_session_attendances
BEFORE UPDATE ON session_attendances
FOR EACH ROW EXECUTE FUNCTION update_updated_at(); 