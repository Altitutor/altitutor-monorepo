-- Migration: Storage RLS Policies for Resources Bucket
-- Description: Fine-grained access control for storage.objects in resources bucket
-- Access rules:
--   ADMINSTAFF: All access (SELECT, INSERT, UPDATE, DELETE)
--   TUTOR: CREATE and READ for subjects they're linked to (via staff_subjects OR classes_staff -> classes -> subjects)
--   STUDENT: READ only if:
--     - Enrolled in class with subject matching file.topic.subject OR
--     - Has tutor_logs_topics_files_students record linking them to that file OR
--     - Has tutor_logs_topics_students record linking them to that file's topic

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Function to check if tutor has access to a subject (by subject_id UUID)
CREATE OR REPLACE FUNCTION public.can_tutor_access_subject(subject_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_tutor_id UUID;
BEGIN
  -- Get current tutor's staff ID
  SELECT id INTO v_tutor_id
  FROM public.staff
  WHERE user_id = auth.uid()
    AND role = 'TUTOR'
    AND status = 'ACTIVE'
  LIMIT 1;
  
  -- If not a tutor, deny access
  IF v_tutor_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if tutor has access to this subject via:
  -- 1. Direct link (staff_subjects)
  -- 2. Indirect link (classes_staff -> classes -> subjects)
  RETURN EXISTS (
    SELECT 1
    FROM public.staff_subjects ss
    WHERE ss.staff_id = v_tutor_id
      AND ss.subject_id = can_tutor_access_subject.subject_id
    
    UNION
    
    SELECT 1
    FROM public.classes_staff cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.staff_id = v_tutor_id
      AND cs.unassigned_at IS NULL
      AND c.subject_id = can_tutor_access_subject.subject_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_tutor_access_subject(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_tutor_access_subject(UUID) IS 'Checks if current tutor has access to a subject via staff_subjects or classes_staff';

-- Function to check if student can read a file by storage path
CREATE OR REPLACE FUNCTION public.can_student_read_file(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_file_id UUID;
  v_student_id UUID;
  v_path_parts TEXT[];
  v_subject_id UUID;
  v_topic_id UUID;
BEGIN
  -- Get current student ID
  SELECT id INTO v_student_id
  FROM public.students
  WHERE user_id = auth.uid();
  
  -- If not a student, deny access
  IF v_student_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Parse path: {subjectId}/{topicId}/{timestamp}_{filename}
  v_path_parts := string_to_array(file_path, '/');
  
  -- Must have at least subjectId/topicId/filename
  IF array_length(v_path_parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Extract subject_id and topic_id from path
  BEGIN
    v_subject_id := v_path_parts[1]::UUID;
    v_topic_id := v_path_parts[2]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE; -- Invalid UUID format
  END;
  
  -- Find file by storage_path and verify it exists and is not deleted
  SELECT f.id INTO v_file_id
  FROM public.files f
  WHERE f.storage_path = file_path
    AND f.deleted_at IS NULL
  LIMIT 1;
  
  -- If file doesn't exist in database, deny access
  IF v_file_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if student has access through any of these conditions:
  -- 1. Enrolled in a class with subject matching file.topic.subject
  -- 2. Has tutor_logs_topics_files_students record linking them to that file
  -- 3. Has tutor_logs_topics_students record linking them to that file's topic
  
  RETURN EXISTS (
    -- Condition 1: Enrolled in class with matching subject
    SELECT 1
    FROM public.classes_students cs
    JOIN public.classes c ON c.id = cs.class_id
    JOIN public.topics t ON t.subject_id = c.subject_id
    JOIN public.topics_files tf ON tf.topic_id = t.id
    WHERE cs.student_id = v_student_id
      AND cs.unenrolled_at IS NULL
      AND c.subject_id = v_subject_id
      AND tf.file_id = v_file_id
    
    UNION
    
    -- Condition 2: Has tutor_logs_topics_files_students record for this file
    SELECT 1
    FROM public.tutor_logs_topics_files_students tltfs
    JOIN public.tutor_logs_topics_files tltf ON tltf.id = tltfs.tutor_logs_topics_files_id
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    WHERE tltfs.student_id = v_student_id
      AND tf.file_id = v_file_id
    
    UNION
    
    -- Condition 3: Has tutor_logs_topics_students record for this file's topic
    SELECT 1
    FROM public.tutor_logs_topics_students tlts
    JOIN public.tutor_logs_topics tlt ON tlt.id = tlts.tutor_logs_topics_id
    JOIN public.topics_files tf ON tf.topic_id = tlt.topic_id
    WHERE tlts.student_id = v_student_id
      AND tf.file_id = v_file_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_student_read_file(TEXT) TO authenticated;

COMMENT ON FUNCTION public.can_student_read_file(TEXT) IS 'Checks if current student can read a file based on enrollments and tutor log associations';

-- Function to check if tutor can create a file at a given path
CREATE OR REPLACE FUNCTION public.can_tutor_create_file(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_path_parts TEXT[];
  v_subject_id UUID;
BEGIN
  -- Parse path: {subjectId}/{topicId}/{timestamp}_{filename}
  v_path_parts := string_to_array(file_path, '/');
  
  -- Must have at least subjectId/topicId/filename
  IF array_length(v_path_parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Extract subject_id from path (first part)
  BEGIN
    v_subject_id := v_path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE; -- Invalid UUID format
  END;
  
  -- Check if tutor has access to this subject
  RETURN public.can_tutor_access_subject(v_subject_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_tutor_create_file(TEXT) TO authenticated;

COMMENT ON FUNCTION public.can_tutor_create_file(TEXT) IS 'Checks if current tutor can create a file at the given path based on subject access';

-- Function to check if tutor can read a file by storage path
CREATE OR REPLACE FUNCTION public.can_tutor_read_file(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_file_id UUID;
  v_path_parts TEXT[];
  v_subject_id UUID;
BEGIN
  -- Parse path: {subjectId}/{topicId}/{timestamp}_{filename}
  v_path_parts := string_to_array(file_path, '/');
  
  -- Must have at least subjectId/topicId/filename
  IF array_length(v_path_parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Extract subject_id from path (first part)
  BEGIN
    v_subject_id := v_path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE; -- Invalid UUID format
  END;
  
  -- Verify file exists in database and is not deleted
  SELECT f.id INTO v_file_id
  FROM public.files f
  WHERE f.storage_path = file_path
    AND f.deleted_at IS NULL
  LIMIT 1;
  
  -- If file doesn't exist, deny access
  IF v_file_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if tutor has access to this subject
  RETURN public.can_tutor_access_subject(v_subject_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_tutor_read_file(TEXT) TO authenticated;

COMMENT ON FUNCTION public.can_tutor_read_file(TEXT) IS 'Checks if current tutor can read a file based on subject access';

-- ========================
-- STORAGE POLICIES
-- ========================
-- NOTE: Storage policies cannot be created via SQL migrations due to ownership restrictions.
-- These policies must be created manually via the Supabase Dashboard:
--   1. Go to Storage > Policies > resources bucket
--   2. Create the following policies using the SQL definitions below
--
-- Alternatively, use the Supabase Management API or Supabase CLI if available.
--
-- Policy SQL Definitions (to be created via Dashboard):
--
-- 1. ADMINSTAFF: All access (SELECT, INSERT, UPDATE, DELETE)
--    Policy name: "ADMINSTAFF all access to resources"
--    Allowed operations: SELECT, INSERT, UPDATE, DELETE
--    Target roles: authenticated
--    Policy definition:
--      bucket_id = 'resources' AND (SELECT public.is_adminstaff_active())
--
-- 2. TUTOR: CREATE (INSERT) access for their subjects
--    Policy name: "TUTOR create files for their subjects"
--    Allowed operations: INSERT
--    Target roles: authenticated
--    Policy definition:
--      bucket_id = 'resources' AND (SELECT public.can_tutor_create_file(name))
--
-- 3. TUTOR: READ (SELECT) access for their subjects
--    Policy name: "TUTOR read files for their subjects"
--    Allowed operations: SELECT
--    Target roles: authenticated
--    Policy definition:
--      bucket_id = 'resources' AND (SELECT public.can_tutor_read_file(name))
--
-- 4. STUDENT: READ (SELECT) access with enrollment/tutor log checks
--    Policy name: "STUDENT read authorized files"
--    Allowed operations: SELECT
--    Target roles: authenticated
--    Policy definition:
--      bucket_id = 'resources' AND (SELECT public.can_student_read_file(name))

-- ========================
-- CREATE PERFORMANCE INDEXES
-- ========================

-- Index for file lookup by path
CREATE INDEX IF NOT EXISTS idx_files_storage_path ON public.files(storage_path) WHERE deleted_at IS NULL;

-- Index for topics_files lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_topics_files_file_id ON public.topics_files(file_id);

-- Index for student subject lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_students_subjects_student_subject ON public.students_subjects(student_id, subject_id);

-- Index for class enrollment lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_classes_students_student_active ON public.classes_students(student_id, unenrolled_at) WHERE unenrolled_at IS NULL;

-- Index for staff_subjects lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_staff_subjects_staff_subject ON public.staff_subjects(staff_id, subject_id);

-- Index for classes_staff lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_classes_staff_staff_active ON public.classes_staff(staff_id, unassigned_at) WHERE unassigned_at IS NULL;

-- Index for tutor_logs_topics_files_students lookups
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_files_students_student ON public.tutor_logs_topics_files_students(student_id);

-- Index for tutor_logs_topics_students lookups
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_students_student ON public.tutor_logs_topics_students(student_id);

-- Index for tutor_logs_topics_files -> topics_files join
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_files_topics_files_id ON public.tutor_logs_topics_files(topics_files_id);

-- Index for tutor_logs_topics -> topics join
CREATE INDEX IF NOT EXISTS idx_tutor_logs_topics_topic_id ON public.tutor_logs_topics(topic_id);

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.can_tutor_access_subject(UUID) IS 'Checks if current tutor has access to a subject via staff_subjects or classes_staff';
COMMENT ON FUNCTION public.can_student_read_file(TEXT) IS 'Checks if current student can read a file based on enrollments and tutor log associations';
COMMENT ON FUNCTION public.can_tutor_create_file(TEXT) IS 'Checks if current tutor can create a file at the given path based on subject access';
COMMENT ON FUNCTION public.can_tutor_read_file(TEXT) IS 'Checks if current tutor can read a file based on subject access';

