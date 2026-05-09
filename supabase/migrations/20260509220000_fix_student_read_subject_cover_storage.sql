-- Subject cover images use path {subject_id}/_subject_image/{filename}.
-- can_student_read_file previously required segment 2 to be a topic UUID, so
-- createSignedUrl for those objects always failed for students.

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
  SELECT id INTO v_student_id
  FROM public.students
  WHERE user_id = auth.uid();

  IF v_student_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_path_parts := string_to_array(file_path, '/');

  IF array_length(v_path_parts, 1) >= 3 AND v_path_parts[2] = '_subject_image' THEN
    BEGIN
      v_subject_id := v_path_parts[1]::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;

    SELECT f.id INTO v_file_id
    FROM public.files f
    INNER JOIN public.subjects_files sf ON sf.file_id = f.id AND sf.subject_id = v_subject_id
    WHERE f.storage_path = file_path
      AND f.deleted_at IS NULL
    LIMIT 1;

    IF v_file_id IS NULL THEN
      RETURN FALSE;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.students_subjects ss
      WHERE ss.student_id = v_student_id
        AND ss.subject_id = v_subject_id

      UNION

      SELECT 1
      FROM public.students_online_access_manual m
      WHERE m.student_id = v_student_id
        AND m.subject_id = v_subject_id

      UNION

      SELECT 1
      FROM public.classes_students cs
      JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = v_student_id
        AND cs.unenrolled_at IS NULL
        AND c.subject_id = v_subject_id

      UNION

      SELECT 1
      FROM public.student_subscriptions subs
      WHERE subs.student_id = v_student_id
        AND subs.subject_id = v_subject_id
        AND subs.status IN ('trialing', 'active')
    );
  END IF;

  IF array_length(v_path_parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;

  BEGIN
    v_subject_id := v_path_parts[1]::UUID;
    v_topic_id := v_path_parts[2]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  SELECT f.id INTO v_file_id
  FROM public.files f
  WHERE f.storage_path = file_path
    AND f.deleted_at IS NULL
  LIMIT 1;

  IF v_file_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
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

    SELECT 1
    FROM public.tutor_logs_topics_files_students tltfs
    JOIN public.tutor_logs_topics_files tltf ON tltf.id = tltfs.tutor_logs_topics_files_id
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    WHERE tltfs.student_id = v_student_id
      AND tf.file_id = v_file_id

    UNION

    SELECT 1
    FROM public.tutor_logs_topics_students tlts
    JOIN public.tutor_logs_topics tlt ON tlt.id = tlts.tutor_logs_topics_id
    JOIN public.topics_files tf ON tf.topic_id = tlt.topic_id
    WHERE tlts.student_id = v_student_id
      AND tf.file_id = v_file_id
  );
END;
$$;

COMMENT ON FUNCTION public.can_student_read_file(TEXT) IS
  'Student read access: topic files via enrollment/tutor logs; subject cover images at {subject_id}/_subject_image/... via subjects_files and same subject access as vstudent_subjects.';
