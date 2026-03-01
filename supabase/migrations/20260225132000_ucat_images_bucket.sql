-- Migration: Create ucat-images storage bucket with RLS policies
-- Description:
--  - Create ucat-images bucket for UCAT question/stem/answer option images
--  - Add helper functions for deriving access from storage path
--  - Add storage RLS policies so tutors can fully manage images
--    and students can only read images for non-private UCAT stems

-- ========================
-- CREATE STORAGE BUCKET
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ucat-images',
  'ucat-images',
  false,
  52428800,  -- 50MB, consistent with session-files
  ARRAY[
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

-- Derive UCAT question_stem_id from storage path.
-- Persisted images will follow: {stemId}/{uuid}_{filename}
CREATE OR REPLACE FUNCTION public.get_ucat_stem_id_from_image_path(file_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_path_parts TEXT[];
  v_stem_id UUID;
BEGIN
  IF file_path IS NULL OR file_path = '' THEN
    RETURN NULL;
  END IF;

  v_path_parts := string_to_array(file_path, '/');

  IF array_length(v_path_parts, 1) < 1 THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_stem_id := v_path_parts[1]::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;

  RETURN v_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ucat_stem_id_from_image_path(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_ucat_stem_id_from_image_path(TEXT) IS
  'Extracts question_stem_id from ucat-images storage path. Expected format: {stemId}/{uuid}_{filename}. Returns NULL for temp or malformed paths.';

-- Students may read images only when:
--  - They are UCAT students (is_ucat_student() = true)
--  - The stem is non-private (is_private = false)
CREATE OR REPLACE FUNCTION public.can_student_access_ucat_image(p_stem_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF p_stem_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT (SELECT public.is_ucat_student()) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.question_stems qs
    WHERE qs.id = p_stem_id
      AND qs.is_private = false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_ucat_image(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_student_access_ucat_image(UUID) IS
  'Checks if current UCAT student can access images for a given non-private UCAT question stem.';

-- ========================
-- STORAGE RLS POLICIES
-- ========================

DO $$
BEGIN
  -- Drop existing policies for idempotency
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Tutors full access to ucat-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Students can read from ucat-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ADMINSTAFF: full access
  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to ucat-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''ucat-images'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''ucat-images'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ADMINSTAFF policy creation for ucat-images - insufficient privileges';
  END;

  -- Tutors: full manage access (create/read/update/delete) for UCAT images.
  -- We rely on is_ucat_tutor() and do not restrict by stem_id here so tutors
  -- can work with temporary images not yet associated with a stem.
  BEGIN
    EXECUTE 'CREATE POLICY "Tutors full access to ucat-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''ucat-images'' AND
        (SELECT public.is_ucat_tutor())
      )
      WITH CHECK (
        bucket_id = ''ucat-images'' AND
        (SELECT public.is_ucat_tutor())
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping Tutor policy creation for ucat-images - insufficient privileges';
  END;

  -- Students: read-only access to images of non-private UCAT stems
  BEGIN
    EXECUTE 'CREATE POLICY "Students can read from ucat-images"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''ucat-images'' AND
        (SELECT public.can_student_access_ucat_image(public.get_ucat_stem_id_from_image_path(name)))
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping Student SELECT policy creation for ucat-images - insufficient privileges';
  END;
END $$;

