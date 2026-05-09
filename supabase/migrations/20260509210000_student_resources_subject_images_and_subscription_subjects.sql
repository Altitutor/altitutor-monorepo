-- Student resources: include subscription-only subjects in student views
-- and add subject image linkage using files table pattern.

-- 1) Subject image linkage table
CREATE TABLE IF NOT EXISTS public.subjects_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  CONSTRAINT subjects_files_subject_unique UNIQUE (subject_id)
);

CREATE INDEX IF NOT EXISTS idx_subjects_files_subject_id ON public.subjects_files(subject_id);
CREATE INDEX IF NOT EXISTS idx_subjects_files_file_id ON public.subjects_files(file_id);

ALTER TABLE public.subjects_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to subjects_files" ON public.subjects_files;
CREATE POLICY "ADMINSTAFF full access to subjects_files"
  ON public.subjects_files
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects_files TO authenticated;

-- 2) Student subjects view: add active subscriptions to subject set
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

  UNION

  SELECT subs.subject_id
  FROM public.student_subscriptions subs
  WHERE subs.student_id = public.current_student_id()
    AND subs.status IN ('trialing', 'active')
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

COMMENT ON VIEW public.vstudent_subjects IS 'Student view: subjects from classes, manual access, or active subscriptions.';

-- 3) Recreate dependent student topic/resource views
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
WHERE t.subject_id IN (SELECT id FROM public.vstudent_subjects)
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
WHERE tf.topic_id IN (SELECT id FROM public.vstudent_topics)
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

-- 4) Student subject image view
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
WHERE sf.subject_id IN (SELECT id FROM public.vstudent_subjects)
  AND f.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_subject_images TO authenticated;

COMMENT ON VIEW public.vstudent_subject_images IS 'Student view: one image file per accessible subject.';
