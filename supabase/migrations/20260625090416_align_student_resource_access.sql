-- Align all student resource read paths to vstudent_my_subject_access.
-- Resource access for students is:
--   - active class enrollment
--   - active/trialing subscription
--   - admin manual access via students_online_access_manual
--
-- students_subjects may still exist for other UX/data-linking purposes, but it
-- must not grant resource access.

CREATE OR REPLACE VIEW public.vstudent_subjects
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
WHERE sub.id IN (
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subjects IS
  'Student resource subjects: subjects granted by vstudent_my_subject_access only.';

CREATE OR REPLACE VIEW public.vstudent_topics
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
  t.code,
  t.created_at,
  t.updated_at,
  t.created_by
FROM public.topics t
WHERE t.subject_id IN (
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vstudent_topics TO authenticated;

COMMENT ON VIEW public.vstudent_topics IS
  'Student resource topics: topics whose subject is granted by vstudent_my_subject_access.';

CREATE OR REPLACE VIEW public.vstudent_topics_files
WITH (security_invoker = false)
AS
SELECT
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.code,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at,
  f.external_url
FROM public.topics_files tf
JOIN public.topics t ON t.id = tf.topic_id
JOIN public.files f ON f.id = tf.file_id
WHERE t.subject_id IN (
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vstudent_topics_files TO authenticated;

COMMENT ON VIEW public.vstudent_topics_files IS
  'Student resource files: files whose topic subject is granted by vstudent_my_subject_access.';

CREATE OR REPLACE VIEW public.vstudent_subject_resources
WITH (security_invoker = false)
AS
WITH RECURSIVE topic_tree AS (
  SELECT
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    1 AS depth,
    ARRAY[t.id] AS path
  FROM public.topics t
  WHERE t.parent_id IS NULL
    AND t.subject_id IN (
      SELECT access.subject_id
      FROM public.vstudent_my_subject_access access
      WHERE access.subject_id IS NOT NULL
    )

  UNION ALL

  SELECT
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    tt.depth + 1,
    tt.path || t.id
  FROM public.topics t
  JOIN topic_tree tt ON t.parent_id = tt.id
  WHERE NOT (t.id = ANY(tt.path))
)
SELECT
  tt.id AS topic_id,
  tt.subject_id,
  tt.name AS topic_name,
  tt.parent_id,
  tt.index AS topic_index,
  tt.depth,
  tt.path AS topic_path,
  (
    SELECT json_agg(json_build_object(
      'id', tf.id,
      'type', tf.type,
      'index', tf.index,
      'code', tf.code,
      'is_solutions', tf.is_solutions,
      'is_solutions_of_id', tf.is_solutions_of_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'external_url', f.external_url,
      'created_at', tf.created_at
    ) ORDER BY tf.type, tf.index)
    FROM public.topics_files tf
    JOIN public.files f ON f.id = tf.file_id
    WHERE tf.topic_id = tt.id
      AND f.deleted_at IS NULL
  ) AS files
FROM topic_tree tt
ORDER BY tt.path;

GRANT SELECT ON public.vstudent_subject_resources TO authenticated;

COMMENT ON VIEW public.vstudent_subject_resources IS
  'Student resource topic tree and files scoped by vstudent_my_subject_access.';

CREATE OR REPLACE VIEW public.vstudent_subject_images
WITH (security_invoker = false)
AS
SELECT
  sf.subject_id,
  f.id AS file_id,
  f.filename,
  f.mimetype,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at,
  sf.created_at,
  sf.updated_at
FROM public.subjects_files sf
JOIN public.files f ON f.id = sf.file_id
WHERE sf.subject_id IN (
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
)
AND f.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_subject_images TO authenticated;

COMMENT ON VIEW public.vstudent_subject_images IS
  'Student resource subject images scoped by vstudent_my_subject_access.';

CREATE OR REPLACE VIEW public.vstudent_flashcard_topics
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.id AS topic_id,
  t.name AS title,
  NULL::TEXT AS description,
  COALESCE(t.index, 0) AS index,
  t.created_at,
  t.updated_at,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards f
    WHERE f.topic_id = t.id AND f.deleted_at IS NULL
  ) AS flashcard_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE f.topic_id = t.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
  ) AS review_card_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    LEFT JOIN public.student_flashcard_review_states s
      ON s.review_card_id = rc.id
      AND s.student_id = public.current_student_id()
    WHERE f.topic_id = t.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
      AND COALESCE(s.due_at, NOW()) <= NOW()
  ) AS due_review_card_count
FROM public.topics t
WHERE t.subject_id IN (
  SELECT access.subject_id
  FROM public.vstudent_my_subject_access access
  WHERE access.subject_id IS NOT NULL
)
AND EXISTS (
  SELECT 1
  FROM public.flashcards f
  WHERE f.topic_id = t.id AND f.deleted_at IS NULL
);

GRANT SELECT ON public.vstudent_flashcard_topics TO authenticated;

COMMENT ON VIEW public.vstudent_flashcard_topics IS
  'Student flashcard topic summaries scoped by vstudent_my_subject_access.';

CREATE OR REPLACE VIEW public.vstudent_flashcard_review_cards
WITH (security_invoker = false)
AS
SELECT
  rc.id,
  rc.flashcard_id,
  rc.cloze_index,
  f.topic_id,
  f.cloze_text,
  f.extra,
  f.index AS flashcard_index,
  COALESCE(s.due_at, NOW()) AS due_at,
  s.stability,
  s.difficulty,
  COALESCE(s.scheduled_days, 0) AS scheduled_days,
  COALESCE(s.learning_steps, 0) AS learning_steps,
  COALESCE(s.reps, 0) AS reps,
  COALESCE(s.lapses, 0) AS lapses,
  COALESCE(s.state, 'New') AS state,
  s.last_reviewed_at,
  s.last_rating
FROM public.flashcard_review_cards rc
JOIN public.flashcards f ON f.id = rc.flashcard_id
JOIN public.topics t ON t.id = f.topic_id
LEFT JOIN public.student_flashcard_review_states s
  ON s.review_card_id = rc.id
  AND s.student_id = public.current_student_id()
WHERE rc.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND t.subject_id IN (
    SELECT access.subject_id
    FROM public.vstudent_my_subject_access access
    WHERE access.subject_id IS NOT NULL
  );

GRANT SELECT ON public.vstudent_flashcard_review_cards TO authenticated;

COMMENT ON VIEW public.vstudent_flashcard_review_cards IS
  'Student flashcard review cards scoped by vstudent_my_subject_access.';

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
      FROM public.vstudent_my_subject_access access
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
    FROM public.vstudent_my_subject_access access
    WHERE access.subject_id = v_subject_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_student_read_file(TEXT) TO authenticated;

COMMENT ON FUNCTION public.can_student_read_file(TEXT) IS
  'Checks whether the current student can read a resources bucket object via vstudent_my_subject_access.';

-- Students and staff should read flashcard resources through views and write
-- through API routes. Base-table direct access is adminstaff only.
DROP POLICY IF EXISTS "Staff read flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Staff write flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Students read accessible flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Staff read flashcard review cards" ON public.flashcard_review_cards;
DROP POLICY IF EXISTS "Students read accessible flashcard review cards" ON public.flashcard_review_cards;
DROP POLICY IF EXISTS "Students own flashcard review states" ON public.student_flashcard_review_states;
DROP POLICY IF EXISTS "Staff read flashcard review states" ON public.student_flashcard_review_states;

DROP POLICY IF EXISTS "ADMINSTAFF full access to flashcards" ON public.flashcards;
CREATE POLICY "ADMINSTAFF full access to flashcards"
  ON public.flashcards
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to flashcard_review_cards" ON public.flashcard_review_cards;
CREATE POLICY "ADMINSTAFF full access to flashcard_review_cards"
  ON public.flashcard_review_cards
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_flashcard_review_states" ON public.student_flashcard_review_states;
CREATE POLICY "ADMINSTAFF full access to student_flashcard_review_states"
  ON public.student_flashcard_review_states
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Remove older permissive resources bucket policies, then install policies
-- aligned to helper functions. These DO blocks tolerate environments where the
-- storage schema owner prevents policy changes from migrations.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads to resources" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated reads from resources" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated deletes from resources" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated updates to resources" ON storage.objects;
  DROP POLICY IF EXISTS "Admin users can upload files to resources bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Admin users can read files from resources bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Admin users can update files in resources bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Admin users can delete files in resources bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Admin users can delete files from resources bucket" ON storage.objects;
  DROP POLICY IF EXISTS "ADMINSTAFF all access to resources" ON storage.objects;
  DROP POLICY IF EXISTS "TUTOR create files for their subjects" ON storage.objects;
  DROP POLICY IF EXISTS "TUTOR read files for their subjects" ON storage.objects;
  DROP POLICY IF EXISTS "STUDENT read authorized files" ON storage.objects;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping storage policy drops - insufficient privileges';
END $$;

DO $$
BEGIN
  CREATE POLICY "ADMINSTAFF all access to resources"
    ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'resources' AND (SELECT public.is_adminstaff_active()))
    WITH CHECK (bucket_id = 'resources' AND (SELECT public.is_adminstaff_active()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF resources storage policy - insufficient privileges';
END $$;

DO $$
BEGIN
  CREATE POLICY "TUTOR create files for their subjects"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'resources' AND (SELECT public.can_tutor_create_file(name)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping TUTOR resources INSERT storage policy - insufficient privileges';
END $$;

DO $$
BEGIN
  CREATE POLICY "TUTOR read files for their subjects"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'resources' AND (SELECT public.can_tutor_read_file(name)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping TUTOR resources SELECT storage policy - insufficient privileges';
END $$;

DO $$
BEGIN
  CREATE POLICY "STUDENT read authorized files"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'resources' AND (SELECT public.can_student_read_file(name)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping STUDENT resources SELECT storage policy - insufficient privileges';
END $$;
