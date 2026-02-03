-- Migration: Create staff-files storage bucket with RLS policies
-- Description:
--  - Create staff-files bucket with 50MB limit and allowed MIME types
--  - Create helper functions for RLS checks
--  - Create storage RLS policies for ADMINSTAFF

-- ========================
-- CREATE STORAGE BUCKET
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-files',
  'staff-files',
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

-- Function to get staff_id from storage path
-- Path format: {staffId}/{timestamp}_{filename}
CREATE OR REPLACE FUNCTION public.get_staff_id_from_storage_path(file_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_path_parts TEXT[];
  v_staff_id UUID;
BEGIN
  -- Parse path: {staffId}/{timestamp}_{filename}
  v_path_parts := string_to_array(file_path, '/');
  
  -- Must have at least staffId/filename
  IF array_length(v_path_parts, 1) < 1 THEN
    RETURN NULL;
  END IF;
  
  -- Extract staff_id from path (first part)
  BEGIN
    v_staff_id := v_path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL; -- Invalid UUID format
  END;
  
  RETURN v_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_id_from_storage_path(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_staff_id_from_storage_path(TEXT) IS 'Extracts staff_id from storage path format: {staffId}/{timestamp}_{filename}';

-- ========================
-- STORAGE RLS POLICIES
-- ========================
-- Note: Storage policies may need to be created manually via Supabase Dashboard
-- if SQL execution fails due to permissions. Policies are created in DO block for graceful handling.

DO $$
BEGIN
  -- Drop existing policies if they exist (idempotent)
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to staff-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ADMINSTAFF: Full access
  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to staff-files"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''staff-files'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''staff-files'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF policy creation - insufficient privileges';
  END;
END $$;
