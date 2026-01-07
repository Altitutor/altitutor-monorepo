-- Migration: Create session-files storage bucket with RLS policies
-- Description:
--  - Create session-files bucket with 50MB limit and allowed MIME types
--  - Create helper functions for RLS checks
--  - Create storage RLS policies for students, tutors, and ADMINSTAFF

-- ========================
-- CREATE STORAGE BUCKET
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-files',
  'session-files',
  false,
  52428800,  -- 50MB
  ARRAY[
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================
-- HELPER FUNCTIONS FOR STORAGE RLS
-- ========================

-- Function to get session_id from storage path
-- Path format: {sessionId}/{timestamp}_{filename}
CREATE OR REPLACE FUNCTION public.get_session_id_from_storage_path(file_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_path_parts TEXT[];
  v_session_id UUID;
BEGIN
  -- Parse path: {sessionId}/{timestamp}_{filename}
  v_path_parts := string_to_array(file_path, '/');
  
  -- Must have at least sessionId/filename
  IF array_length(v_path_parts, 1) < 1 THEN
    RETURN NULL;
  END IF;
  
  -- Extract session_id from path (first part)
  BEGIN
    v_session_id := v_path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL; -- Invalid UUID format
  END;
  
  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_id_from_storage_path(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_session_id_from_storage_path(TEXT) IS 'Extracts session_id from storage path format: {sessionId}/{timestamp}_{filename}';

-- Function to check if student can access a session file
CREATE OR REPLACE FUNCTION public.can_student_access_session_file(session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  -- Get current student ID
  SELECT id INTO v_student_id
  FROM public.students
  WHERE user_id = auth.uid();
  
  -- If not a student, deny access
  IF v_student_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if student is enrolled in this session
  RETURN EXISTS (
    SELECT 1
    FROM public.sessions_students ss
    WHERE ss.session_id = can_student_access_session_file.session_id
      AND ss.student_id = v_student_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_session_file(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_student_access_session_file(UUID) IS 'Checks if current student can access files for a given session via sessions_students';

-- Function to check if tutor can access a session file
CREATE OR REPLACE FUNCTION public.can_tutor_access_session_file(session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_tutor_id UUID;
BEGIN
  -- Get current tutor ID
  SELECT id INTO v_tutor_id
  FROM public.staff
  WHERE user_id = auth.uid()
    AND role IN ('TUTOR', 'ADMINSTAFF')
    AND status = 'ACTIVE'
  LIMIT 1;
  
  -- If not a tutor/admin, deny access
  IF v_tutor_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if tutor is assigned to this session
  RETURN EXISTS (
    SELECT 1
    FROM public.sessions_staff ssf
    WHERE ssf.session_id = can_tutor_access_session_file.session_id
      AND ssf.staff_id = v_tutor_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_tutor_access_session_file(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_tutor_access_session_file(UUID) IS 'Checks if current tutor can access files for a given session via sessions_staff';

-- ========================
-- STORAGE RLS POLICIES
-- ========================
-- Note: Storage policies may need to be created manually via Supabase Dashboard
-- if SQL execution fails due to permissions. Policies are created in DO block for graceful handling.

DO $$
BEGIN
  -- Drop existing policies if they exist (idempotent)
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Students can create files in session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Students can read files from session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Students can update files in session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Students can delete files from session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Tutors can create files in session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Tutors can read files from session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Tutors can update files in session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Tutors can delete files from session-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ADMINSTAFF: Full access
  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to session-files"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''session-files'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF policy creation - insufficient privileges';
  END;

  -- Students: CREATE (INSERT)
  BEGIN
    EXECUTE 'CREATE POLICY "Students can create files in session-files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = ''session-files'' AND
        (SELECT public.can_student_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Student INSERT policy creation - insufficient privileges';
  END;

  -- Students: READ (SELECT)
  BEGIN
    EXECUTE 'CREATE POLICY "Students can read files from session-files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_student_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Student SELECT policy creation - insufficient privileges';
  END;

  -- Students: UPDATE
  BEGIN
    EXECUTE 'CREATE POLICY "Students can update files in session-files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_student_access_session_file(public.get_session_id_from_storage_path(name)))
      )
      WITH CHECK (
        bucket_id = ''session-files'' AND
        (SELECT public.can_student_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Student UPDATE policy creation - insufficient privileges';
  END;

  -- Students: DELETE
  BEGIN
    EXECUTE 'CREATE POLICY "Students can delete files from session-files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_student_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Student DELETE policy creation - insufficient privileges';
  END;

  -- Tutors: CREATE (INSERT)
  BEGIN
    EXECUTE 'CREATE POLICY "Tutors can create files in session-files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = ''session-files'' AND
        (SELECT public.can_tutor_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Tutor INSERT policy creation - insufficient privileges';
  END;

  -- Tutors: READ (SELECT)
  BEGIN
    EXECUTE 'CREATE POLICY "Tutors can read files from session-files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_tutor_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Tutor SELECT policy creation - insufficient privileges';
  END;

  -- Tutors: UPDATE
  BEGIN
    EXECUTE 'CREATE POLICY "Tutors can update files in session-files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_tutor_access_session_file(public.get_session_id_from_storage_path(name)))
      )
      WITH CHECK (
        bucket_id = ''session-files'' AND
        (SELECT public.can_tutor_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Tutor UPDATE policy creation - insufficient privileges';
  END;

  -- Tutors: DELETE
  BEGIN
    EXECUTE 'CREATE POLICY "Tutors can delete files from session-files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = ''session-files'' AND
        (SELECT public.can_tutor_access_session_file(public.get_session_id_from_storage_path(name)))
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping Tutor DELETE policy creation - insufficient privileges';
  END;
END $$;

