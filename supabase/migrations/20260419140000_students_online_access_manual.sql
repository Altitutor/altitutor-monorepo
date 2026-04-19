-- Migration: Manual online access per subject (admin-granted)
-- Description: Adds students_online_access_manual (student_id, subject_id); backfills from students_subjects;
--              clears students_subjects (auto-enrollment trigger repopulates); updates vstudent_my_subject_access,
--              vstudent_subjects, search_students_admin.

-- ========================
-- 1) Table
-- ========================
CREATE TABLE public.students_online_access_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  notes TEXT,
  CONSTRAINT students_online_access_manual_student_subject_unique UNIQUE (student_id, subject_id)
);

CREATE INDEX idx_students_online_access_manual_student_id ON public.students_online_access_manual(student_id);
CREATE INDEX idx_students_online_access_manual_subject_id ON public.students_online_access_manual(subject_id);

COMMENT ON TABLE public.students_online_access_manual IS 'Admin-granted manual online product access per student and subject (any subject).';

ALTER TABLE public.students_online_access_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to students_online_access_manual"
  ON public.students_online_access_manual
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students_online_access_manual TO authenticated;

-- ========================
-- 2) Backfill from students_subjects, then clear join table (class auto-link repopulates)
-- ========================
INSERT INTO public.students_online_access_manual (student_id, subject_id, created_at, created_by, notes)
SELECT ss.student_id, ss.subject_id, ss.created_at, ss.created_by, NULL::TEXT
FROM public.students_subjects ss
ON CONFLICT (student_id, subject_id) DO NOTHING;

DELETE FROM public.students_subjects;

-- ========================
-- 3) vstudent_my_subject_access — manual from students_subjects OR students_online_access_manual (deduped)
-- ========================
CREATE OR REPLACE VIEW public.vstudent_my_subject_access
WITH (security_invoker = false)
AS
SELECT DISTINCT
  cs.student_id,
  c.subject_id,
  'class_enrollment'::TEXT AS access_source
FROM public.classes_students cs
JOIN public.classes c ON c.id = cs.class_id
WHERE cs.student_id = (SELECT public.current_student_id())
  AND cs.unenrolled_at IS NULL

UNION

SELECT DISTINCT
  ss.student_id,
  ss.subject_id,
  'subscription'::TEXT AS access_source
FROM public.student_subscriptions ss
WHERE ss.student_id = (SELECT public.current_student_id())
  AND ss.status IN ('trialing', 'active')

UNION

SELECT DISTINCT
  ssub.student_id,
  ssub.subject_id,
  'manual'::TEXT AS access_source
FROM public.students_subjects ssub
WHERE ssub.student_id = (SELECT public.current_student_id())

UNION

SELECT DISTINCT
  m.student_id,
  m.subject_id,
  'manual'::TEXT AS access_source
FROM public.students_online_access_manual m
WHERE m.student_id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_my_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_my_subject_access IS 'Per-subject access: class_enrollment, subscription (trialing/active), manual (students_subjects and/or students_online_access_manual).';

COMMENT ON FUNCTION public.is_ucat_online_student() IS 'UCAT via active subscription (trialing/active) or manual row in students_online_access_manual for UCAT subject (or students_subjects).';

COMMENT ON FUNCTION public.is_ucat_student() IS 'Any UCAT access: class, subscription, or manual assignment.';

-- ========================
-- 4) vstudent_subjects — direct subjects from both join sources
-- ========================
DROP VIEW IF EXISTS public.vstudent_subjects CASCADE;

CREATE VIEW public.vstudent_subjects
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
  SELECT ss.subject_id
  FROM public.students_subjects ss
  WHERE ss.student_id = public.current_student_id()

  UNION

  SELECT m.subject_id
  FROM public.students_online_access_manual m
  WHERE m.student_id = public.current_student_id()

  UNION

  SELECT c.subject_id
  FROM public.classes_students cs
  JOIN public.classes c ON c.id = cs.class_id
  WHERE cs.student_id = public.current_student_id()
    AND c.subject_id IS NOT NULL
    AND cs.unenrolled_at IS NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subjects IS 'Student view: Subjects from classes, students_subjects, or students_online_access_manual.';

-- Dependent views (same definitions as 20260108224239_add_subject_short_long_name_columns.sql)
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
  SELECT id FROM public.vstudent_subjects
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vstudent_topics TO authenticated;

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
  f.deleted_at
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (
  SELECT id FROM public.vstudent_topics
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vstudent_topics_files TO authenticated;

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
  AND t.subject_id IN (SELECT id FROM public.vstudent_subjects vs)

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
      'is_solutions', tf.is_solutions,
      'is_solutions_of_id', tf.is_solutions_of_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'created_at', tf.created_at
    ) ORDER BY tf.index)
    FROM public.topics_files tf
    JOIN public.files f ON f.id = tf.file_id
    WHERE tf.topic_id = tt.id
    AND f.deleted_at IS NULL
  ) AS files
FROM topic_tree tt
ORDER BY tt.path;

GRANT SELECT ON public.vstudent_subject_resources TO authenticated;

-- ========================
-- 5) search_students_admin — subject filter includes students_online_access_manual for any subject
-- ========================
CREATE OR REPLACE FUNCTION search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_class_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE,
  p_subscription_filter TEXT DEFAULT NULL,
  p_in_person_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_student_ids UUID[];
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_student_ids
    FROM students
    WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_students AS (
    SELECT
      s.id,
      s.first_name,
      s.last_name,
      s.status,
      s.curriculum,
      s.year_level,
      s.school,
      s.phone,
      s.email,
      s.created_at,
      s.updated_at,
      EXISTS (
        SELECT 1
        FROM student_subscriptions ss
        WHERE ss.student_id = s.id
      ) AS has_online_subscription,
      EXISTS (
        SELECT 1
        FROM classes_students cs
        WHERE cs.student_id = s.id
          AND cs.unenrolled_at IS NULL
      ) AS has_in_person_class,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
        ELSE 0
      END AS relevance_score
    FROM students s
    WHERE (v_student_ids IS NULL OR (array_length(v_student_ids, 1) > 0 AND s.id = ANY(v_student_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      AND (
        p_subject_ids IS NULL
        OR array_length(p_subject_ids, 1) IS NULL
        OR EXISTS (
          SELECT 1
          FROM students_subjects ss
          WHERE ss.student_id = s.id
            AND ss.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM students_online_access_manual som
          WHERE som.student_id = s.id
            AND som.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM classes_students cs
          JOIN classes c ON c.id = cs.class_id
          WHERE cs.student_id = s.id
            AND cs.unenrolled_at IS NULL
            AND c.subject_id = ANY(p_subject_ids)
        )
      )
      AND (
        p_subscription_filter IS NULL
        OR p_subscription_filter NOT IN ('has', 'none')
        OR (p_subscription_filter = 'has' AND EXISTS (
          SELECT 1
          FROM student_subscriptions ss2
          WHERE ss2.student_id = s.id
        ))
        OR (p_subscription_filter = 'none' AND NOT EXISTS (
          SELECT 1
          FROM student_subscriptions ss2
          WHERE ss2.student_id = s.id
        ))
      )
      AND (
        p_in_person_filter IS NULL
        OR p_in_person_filter NOT IN ('has', 'none')
        OR (p_in_person_filter = 'has' AND EXISTS (
          SELECT 1
          FROM classes_students cs2
          WHERE cs2.student_id = s.id
            AND cs2.unenrolled_at IS NULL
        ))
        OR (p_in_person_filter = 'none' AND NOT EXISTS (
          SELECT 1
          FROM classes_students cs2
          WHERE cs2.student_id = s.id
            AND cs2.unenrolled_at IS NULL
        ))
      )
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'curriculum' AND p_ascending THEN curriculum END ASC,
      CASE WHEN p_order_by = 'curriculum' AND NOT p_ascending THEN curriculum END DESC,
      CASE WHEN p_order_by = 'year_level' AND p_ascending THEN year_level END ASC,
      CASE WHEN p_order_by = 'year_level' AND NOT p_ascending THEN year_level END DESC,
      last_name ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'first_name', ps.first_name,
        'last_name', ps.last_name,
        'status', ps.status,
        'curriculum', ps.curriculum,
        'year_level', ps.year_level,
        'school', ps.school,
        'phone', ps.phone,
        'email', ps.email,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at,
        'has_online_subscription', ps.has_online_subscription,
        'has_in_person_class', ps.has_in_person_class,
        'classes', CASE
          WHEN p_include_relationships THEN (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', c.id,
                  'short_name', c.short_name,
                  'long_name', c.long_name,
                  'day_of_week', c.day_of_week,
                  'start_time', c.start_time::TEXT,
                  'end_time', c.end_time::TEXT,
                  'level', c.level,
                  'subject', jsonb_build_object(
                    'id', subj.id,
                    'curriculum', subj.curriculum,
                    'year_level', subj.year_level,
                    'name', subj.name,
                    'discipline', subj.discipline,
                    'level', subj.level,
                    'color', subj.color,
                    'short_name', subj.short_name,
                    'long_name', subj.long_name
                  )
                )
                ORDER BY c.day_of_week, c.start_time
              ),
              '[]'::jsonb
            )
            FROM classes_students cs
            JOIN classes c ON c.id = cs.class_id
            LEFT JOIN subjects subj ON subj.id = c.subject_id
            WHERE cs.student_id = ps.id
              AND cs.unenrolled_at IS NULL
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students ps;

  RETURN jsonb_build_object(
    'students', COALESCE(v_students, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.search_students_admin(
  text,
  text[],
  uuid[],
  boolean,
  boolean,
  integer,
  integer,
  text,
  boolean,
  text,
  text
) IS 'Admin search for students. Subject filter includes students_subjects, students_online_access_manual, and class subject.';
