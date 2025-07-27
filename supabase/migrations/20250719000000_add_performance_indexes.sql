-- Add performance indexes for commonly queried fields
-- These indexes will significantly improve query performance for the admin app

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_year_level ON students(year_level);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at);
CREATE INDEX IF NOT EXISTS idx_students_updated_at ON students(updated_at);

-- Staff table indexes
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_created_at ON staff(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_updated_at ON staff(updated_at);

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_subject_id ON classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_day_of_week ON classes(day_of_week);
CREATE INDEX IF NOT EXISTS idx_classes_start_time ON classes(start_time);
CREATE INDEX IF NOT EXISTS idx_classes_created_at ON classes(created_at);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Subjects table indexes
CREATE INDEX IF NOT EXISTS idx_subjects_curriculum ON subjects(curriculum);
CREATE INDEX IF NOT EXISTS idx_subjects_year_level ON subjects(year_level);
CREATE INDEX IF NOT EXISTS idx_subjects_discipline ON subjects(discipline);
CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(level);

-- Topics table indexes
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_number ON topics(number);

-- Subtopics table indexes
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_number ON subtopics(number);

-- Junction table indexes for many-to-many relationships
-- Students-Subjects relationship
CREATE INDEX IF NOT EXISTS idx_students_subjects_student_id ON students_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_students_subjects_subject_id ON students_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_students_subjects_composite ON students_subjects(student_id, subject_id);

-- Staff-Subjects relationship
CREATE INDEX IF NOT EXISTS idx_staff_subjects_staff_id ON staff_subjects(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_subjects_subject_id ON staff_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_staff_subjects_composite ON staff_subjects(staff_id, subject_id);

-- Classes-Students relationship
CREATE INDEX IF NOT EXISTS idx_classes_students_class_id ON classes_students(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_students_student_id ON classes_students(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_students_composite ON classes_students(class_id, student_id);

-- Sessions-Students relationship (attendance)
CREATE INDEX IF NOT EXISTS idx_sessions_students_session_id ON sessions_students(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_students_student_id ON sessions_students(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_students_composite ON sessions_students(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_students_attended ON sessions_students(attended);

-- Sessions-Staff relationship
CREATE INDEX IF NOT EXISTS idx_sessions_staff_session_id ON sessions_staff(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_staff_id ON sessions_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_composite ON sessions_staff(session_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_type ON sessions_staff(type);

-- Resource files indexes
CREATE INDEX IF NOT EXISTS idx_sessions_resource_files_session_id ON sessions_resource_files(session_id);

-- Composite indexes for common query patterns
-- Students with their subjects and classes
CREATE INDEX IF NOT EXISTS idx_students_status_year_level ON students(status, year_level);

-- Classes with their subject and schedule
CREATE INDEX IF NOT EXISTS idx_classes_subject_day_time ON classes(subject_id, day_of_week, start_time);

-- Sessions with their class and date
CREATE INDEX IF NOT EXISTS idx_sessions_class_date ON sessions(class_id, date);

-- Staff with their role and status
CREATE INDEX IF NOT EXISTS idx_staff_role_status ON staff(role, status);

-- Add comments for documentation
COMMENT ON INDEX idx_students_status IS 'Index for filtering students by status';
COMMENT ON INDEX idx_students_year_level IS 'Index for filtering students by year level';
COMMENT ON INDEX idx_classes_subject_id IS 'Index for finding classes by subject';
COMMENT ON INDEX idx_sessions_class_id IS 'Index for finding sessions by class';
COMMENT ON INDEX idx_sessions_date IS 'Index for finding sessions by date';
COMMENT ON INDEX idx_students_subjects_composite IS 'Composite index for student-subject relationships';
COMMENT ON INDEX idx_staff_subjects_composite IS 'Composite index for staff-subject relationships';
COMMENT ON INDEX idx_classes_students_composite IS 'Composite index for class-student relationships';
COMMENT ON INDEX idx_sessions_students_composite IS 'Composite index for session attendance';
COMMENT ON INDEX idx_sessions_staff_composite IS 'Composite index for session staff assignments'; 