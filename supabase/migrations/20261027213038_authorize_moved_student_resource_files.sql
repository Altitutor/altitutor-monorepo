-- Storage paths are immutable object identities; a topic move updates the
-- resource link, not the object's key. Authorize its current topic entitlement.
CREATE OR REPLACE FUNCTION public.can_student_read_file(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  path_parts text[];
  v_subject_id uuid;
BEGIN
  IF public.current_student_id() IS NULL THEN RETURN false; END IF;
  path_parts := pg_catalog.string_to_array(file_path, '/');

  -- Subject covers keep their existing separate ownership contract.
  IF pg_catalog.array_length(path_parts, 1) >= 3 AND path_parts[2] = '_subject_image' THEN
    BEGIN
      v_subject_id := path_parts[1]::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
    RETURN EXISTS (
      SELECT 1
      FROM public.files AS file
      JOIN public.subjects_files AS link ON link.file_id = file.id
      JOIN public.vstudent_online_subject_access AS access ON access.subject_id = link.subject_id
      WHERE file.storage_path = file_path AND file.bucket = 'resources'
        AND file.deleted_at IS NULL AND link.subject_id = v_subject_id
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.files AS file
    JOIN public.topics_files AS link ON link.file_id = file.id
    JOIN public.topics AS topic ON topic.id = link.topic_id
    JOIN public.vstudent_online_subject_access AS access ON access.subject_id = topic.subject_id
    WHERE file.storage_path = file_path AND file.bucket = 'resources'
      AND file.deleted_at IS NULL
  );
END;
$$;
COMMENT ON FUNCTION public.can_student_read_file(text) IS
  'Authorizes the exact resources object path through its current linked topic or subject-cover entitlement.';
