-- Give each student-subject view one explicit product meaning:
--   - vstudent_in_person_subjects: subjects the student intends to study in person
--   - vstudent_online_subject_access: current online entitlements and their source
--   - vstudent_online_subjects: display metadata for currently entitled subjects
--   - vstudent_subscription_subjects: display metadata for current and historical subscriptions
--
-- The old names remain as deprecated compatibility aliases so independently
-- deployed clients do not break while first-party consumers migrate.

ALTER VIEW public.vstudent_my_subject_access
  RENAME TO vstudent_online_subject_access;

GRANT SELECT ON public.vstudent_online_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_online_subject_access IS
  'Current student online subject entitlements: class enrollment, subscription (trialing/active/past_due), or admin manual access. May return multiple access-source rows per subject.';

CREATE VIEW public.vstudent_in_person_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.short_name,
  sub.long_name,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE EXISTS (
  SELECT 1
  FROM public.students_subjects student_subject
  WHERE student_subject.student_id = (SELECT public.current_student_id())
    AND student_subject.subject_id = sub.id
);

GRANT SELECT ON public.vstudent_in_person_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_in_person_subjects IS
  'Subjects the current student intends to study in person, linked through students_subjects. This view does not grant online resource access.';

CREATE VIEW public.vstudent_online_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.short_name,
  sub.long_name,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE EXISTS (
  SELECT 1
  FROM public.vstudent_online_subject_access access
  WHERE access.subject_id = sub.id
);

GRANT SELECT ON public.vstudent_online_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_online_subjects IS
  'Complete subject display metadata for the current student online subject entitlements.';

CREATE VIEW public.vstudent_subscription_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.short_name,
  sub.long_name,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE EXISTS (
  SELECT 1
  FROM public.student_subscriptions subscription
  WHERE subscription.student_id = (SELECT public.current_student_id())
    AND subscription.subject_id = sub.id
);

GRANT SELECT ON public.vstudent_subscription_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subscription_subjects IS
  'Subject display metadata for all current student subscriptions, including subscriptions that no longer grant online access.';

-- Deprecated compatibility alias. Its historical name is ambiguous; new code
-- must use vstudent_in_person_subjects explicitly.
CREATE OR REPLACE VIEW public.vstudent_subjects
WITH (security_invoker = false)
AS
SELECT *
FROM public.vstudent_in_person_subjects;

GRANT SELECT ON public.vstudent_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subjects IS
  'DEPRECATED compatibility alias for vstudent_in_person_subjects. New code must use the explicit view name.';

-- Deprecated compatibility alias for clients deployed before this migration.
CREATE VIEW public.vstudent_my_subject_access
WITH (security_invoker = false)
AS
SELECT *
FROM public.vstudent_online_subject_access;

GRANT SELECT ON public.vstudent_my_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_my_subject_access IS
  'DEPRECATED compatibility alias for vstudent_online_subject_access. New code must use the explicit view name.';

-- Stored view dependencies follow the renamed view OID automatically. Refresh
-- their documentation so the schema itself uses the new vocabulary.
COMMENT ON VIEW public.vstudent_topics IS
  'Student resource topics whose subject is granted by vstudent_online_subject_access.';
COMMENT ON VIEW public.vstudent_topics_files IS
  'Student resource files whose topic subject is granted by vstudent_online_subject_access.';
COMMENT ON VIEW public.vstudent_subject_resources IS
  'Student resource topic tree and files scoped by vstudent_online_subject_access.';
COMMENT ON VIEW public.vstudent_subject_images IS
  'Student resource subject images scoped by vstudent_online_subject_access.';
COMMENT ON VIEW public.vstudent_flashcard_topics IS
  'Student flashcard topic summaries scoped by vstudent_online_subject_access.';
COMMENT ON VIEW public.vstudent_flashcard_review_cards IS
  'Student flashcard review cards scoped by vstudent_online_subject_access.';

-- Function bodies are stored as text and therefore do not follow a relation
-- rename. Recreate the two live functions that referenced the old view name.
CREATE OR REPLACE FUNCTION public.is_ucat_in_person_student()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vstudent_online_subject_access access
    WHERE access.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND access.access_source = 'class_enrollment'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_student_read_file(file_path TEXT)
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
  v_topic_id UUID;
BEGIN
  IF public.current_student_id() IS NULL THEN
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
    JOIN public.subjects_files sf ON sf.file_id = f.id AND sf.subject_id = v_subject_id
    WHERE f.storage_path = file_path
      AND f.deleted_at IS NULL
    LIMIT 1;

    IF v_file_id IS NULL THEN
      RETURN FALSE;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.vstudent_online_subject_access access
      WHERE access.subject_id = v_subject_id
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
  JOIN public.topics_files tf ON tf.file_id = f.id
  JOIN public.topics t ON t.id = tf.topic_id
  WHERE f.storage_path = file_path
    AND f.deleted_at IS NULL
    AND t.id = v_topic_id
    AND t.subject_id = v_subject_id
  LIMIT 1;

  IF v_file_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.vstudent_online_subject_access access
    WHERE access.subject_id = v_subject_id
  );
END;
$$;

COMMENT ON FUNCTION public.can_student_read_file(TEXT) IS
  'Checks whether the current student can read a resources bucket object through vstudent_online_subject_access.';
