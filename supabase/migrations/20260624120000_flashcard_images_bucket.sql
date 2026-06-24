-- Create private storage for flashcard rich-text images.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flashcard-images',
  'flashcard-images',
  false,
  52428800,
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

CREATE OR REPLACE FUNCTION public.get_topic_id_from_flashcard_image_path(file_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_path_parts TEXT[];
BEGIN
  IF file_path IS NULL OR file_path = '' THEN
    RETURN NULL;
  END IF;

  v_path_parts := string_to_array(file_path, '/');
  IF array_length(v_path_parts, 1) < 1 THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_path_parts[1]::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_topic_id_from_flashcard_image_path(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_student_access_flashcard_image(p_topic_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF p_topic_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.vstudent_topics t
    WHERE t.id = p_topic_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_student_access_flashcard_image(UUID) TO authenticated;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to flashcard-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Tutors full access to flashcard-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Students can read from flashcard-images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to flashcard-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''flashcard-images'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''flashcard-images'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ADMINSTAFF policy creation for flashcard-images - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Tutors full access to flashcard-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''flashcard-images'' AND
        (SELECT public.is_tutor())
      )
      WITH CHECK (
        bucket_id = ''flashcard-images'' AND
        (SELECT public.is_tutor())
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping Tutor policy creation for flashcard-images - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Students can read from flashcard-images"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''flashcard-images'' AND
        (SELECT public.can_student_access_flashcard_image(public.get_topic_id_from_flashcard_image_path(name)))
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping Student SELECT policy creation for flashcard-images - insufficient privileges';
  END;
END $$;
