-- Migration: Add subject short_name and long_name columns with trigger updates
-- Description:
--   - Add short_name and long_name columns to subjects table
--   - Create trigger function to auto-update these columns on INSERT/UPDATE
--   - Backfill existing data
--   - Update views (vtutor_subjects, vstudent_subjects) to include new columns
--
-- Format specifications:
--   short_name: {CURRICULUM if IB} {year_level}{first4} {LEVEL} (all caps)
--     Examples: "12MATH", "IB 12MATH HL"
--   long_name: {curriculum} {year_level} {name} {level}
--     Examples: "SACE 12 Mathematics", "IB 12 Mathematics AA HL"

-- ========================
-- ADD COLUMNS TO SUBJECTS TABLE
-- ========================

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS long_name TEXT;

-- Add comments
COMMENT ON COLUMN public.subjects.short_name IS 'Auto-generated short name: {CURRICULUM if IB} {year_level}{first4} {LEVEL} (all caps)';
COMMENT ON COLUMN public.subjects.long_name IS 'Auto-generated long name: {curriculum} {year_level} {name} {level}';

-- ========================
-- CREATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.update_subject_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_short_name TEXT;
  v_long_name TEXT;
  v_year_level_text TEXT;
  v_first_four TEXT;
  v_curriculum_upper TEXT;
  v_level_upper TEXT;
BEGIN
  -- Calculate short_name: {CURRICULUM if IB} {year_level}{first4} {LEVEL} (all caps)
  v_year_level_text := CASE WHEN NEW.year_level IS NOT NULL THEN NEW.year_level::TEXT ELSE '' END;
  v_first_four := UPPER(LEFT(COALESCE(NEW.name, ''), 4));
  v_curriculum_upper := CASE WHEN NEW.curriculum = 'IB' THEN 'IB' ELSE '' END;
  v_level_upper := CASE WHEN NEW.level IS NOT NULL THEN UPPER(NEW.level) ELSE '' END;
  
  -- Build short_name parts
  v_short_name := TRIM(
    CONCAT(
      v_curriculum_upper,
      CASE WHEN v_curriculum_upper != '' AND (v_year_level_text != '' OR v_first_four != '') THEN ' ' ELSE '' END,
      v_year_level_text,
      v_first_four,
      CASE WHEN v_level_upper != '' AND (v_year_level_text != '' OR v_first_four != '') THEN ' ' ELSE '' END,
      v_level_upper
    )
  );
  
  -- Fix double spaces (can occur when curriculum is IB and we have year_level/name)
  v_short_name := REPLACE(v_short_name, '  ', ' ');
  
  -- Calculate long_name: {curriculum} {year_level} {name} {level}
  v_long_name := TRIM(
    CONCAT(
      COALESCE(NEW.curriculum::TEXT, ''),
      CASE WHEN NEW.curriculum IS NOT NULL AND NEW.year_level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(NEW.year_level::TEXT, ''),
      CASE WHEN NEW.year_level IS NOT NULL AND NEW.name IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(NEW.name, ''),
      CASE WHEN NEW.name IS NOT NULL AND NEW.level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(NEW.level, '')
    )
  );
  
  -- Set the values
  NEW.short_name := v_short_name;
  NEW.long_name := v_long_name;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_subject_names() IS 'Trigger function that auto-generates short_name and long_name columns for subjects table';

-- ========================
-- CREATE TRIGGER
-- ========================

DROP TRIGGER IF EXISTS trigger_update_subject_names ON public.subjects;

CREATE TRIGGER trigger_update_subject_names
  BEFORE INSERT OR UPDATE OF curriculum, year_level, name, level ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subject_names();

-- ========================
-- BACKFILL EXISTING DATA
-- ========================

-- Update all existing subjects using the trigger function logic
UPDATE public.subjects
SET 
  short_name = TRIM(
    CONCAT(
      CASE WHEN curriculum = 'IB' THEN 'IB' ELSE '' END,
      CASE WHEN curriculum = 'IB' AND (year_level IS NOT NULL OR name IS NOT NULL) THEN ' ' ELSE '' END,
      COALESCE(year_level::TEXT, ''),
      UPPER(LEFT(COALESCE(name, ''), 4)),
      CASE WHEN level IS NOT NULL AND (year_level IS NOT NULL OR name IS NOT NULL) THEN ' ' ELSE '' END,
      CASE WHEN level IS NOT NULL THEN UPPER(level) ELSE '' END
    )
  ),
  long_name = TRIM(
    CONCAT(
      COALESCE(curriculum::TEXT, ''),
      CASE WHEN curriculum IS NOT NULL AND year_level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(year_level::TEXT, ''),
      CASE WHEN year_level IS NOT NULL AND name IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(name, ''),
      CASE WHEN name IS NOT NULL AND level IS NOT NULL THEN ' ' ELSE '' END,
      COALESCE(level, '')
    )
  )
WHERE short_name IS NULL OR long_name IS NULL;

-- ========================
-- UPDATE VIEWS
-- ========================

-- Drop and recreate vtutor_subjects view to include short_name and long_name
-- Must drop first because PostgreSQL doesn't allow changing column order with CREATE OR REPLACE
-- CASCADE will drop dependent views (vtutor_topics, vtutor_topics_files) which we'll recreate below
DROP VIEW IF EXISTS public.vtutor_subjects CASCADE;

CREATE VIEW public.vtutor_subjects
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
  SELECT DISTINCT c.subject_id
  FROM public.classes c
  JOIN public.classes_staff cs ON cs.class_id = c.id
  WHERE cs.staff_id = public.current_staff_id()
  AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vtutor_subjects TO authenticated;

-- Drop and recreate vstudent_subjects view to include short_name and long_name
-- Must drop first because PostgreSQL doesn't allow changing column order with CREATE OR REPLACE
-- CASCADE will drop dependent views (vstudent_subject_resources) which we'll recreate below
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
  -- Subjects from students_subjects
  SELECT ss.subject_id
  FROM public.students_subjects ss
  WHERE ss.student_id = public.current_student_id()
  
  UNION
  
  -- Subjects from enrolled classes
  SELECT c.subject_id
  FROM public.classes_students cs
  JOIN public.classes c ON c.id = cs.class_id
  WHERE cs.student_id = public.current_student_id()
  AND c.subject_id IS NOT NULL
  AND cs.unenrolled_at IS NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

-- ========================
-- RECREATE DEPENDENT VIEWS
-- ========================

-- Recreate vtutor_topics view (depends on vtutor_subjects)
CREATE OR REPLACE VIEW public.vtutor_topics
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
  SELECT id FROM public.vtutor_subjects
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vtutor_topics TO authenticated;

COMMENT ON VIEW public.vtutor_topics IS 'Tutor view: All topics for authorized subjects';

-- Recreate vtutor_topics_files view (depends on vtutor_topics)
CREATE OR REPLACE VIEW public.vtutor_topics_files
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
  -- File details
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
  SELECT id FROM public.vtutor_topics
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vtutor_topics_files TO authenticated;

COMMENT ON VIEW public.vtutor_topics_files IS 'Tutor view: All topics_files for authorized topics';

-- Recreate vstudent_topics view (depends on vstudent_subjects)
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

COMMENT ON VIEW public.vstudent_topics IS 'Student view: All topics for authorized subjects';

-- Recreate vstudent_topics_files view (depends on vstudent_topics)
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
  -- File details
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

COMMENT ON VIEW public.vstudent_topics_files IS 'Student view: All topics_files with file details for authorized topics';

-- Recreate vstudent_subject_resources view (depends on vstudent_subjects)
CREATE OR REPLACE VIEW public.vstudent_subject_resources
WITH (security_invoker = false)
AS
WITH RECURSIVE topic_tree AS (
  -- Base case: top-level topics
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
  
  -- Recursive case: child topics
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
  -- Files for this topic
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
-- VERIFICATION QUERIES (for testing)
-- ========================

-- These queries can be run manually to verify the migration worked correctly
-- Uncomment and run after migration to test:

-- Check that all subjects have short_name and long_name populated
-- SELECT COUNT(*) as total_subjects,
--        COUNT(short_name) as subjects_with_short_name,
--        COUNT(long_name) as subjects_with_long_name
-- FROM public.subjects;

-- Check a few sample subjects to verify format
-- SELECT 
--   id,
--   curriculum,
--   year_level,
--   name,
--   level,
--   short_name,
--   long_name
-- FROM public.subjects
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Verify views include new columns
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vtutor_subjects'
-- ORDER BY ordinal_position;

-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'vstudent_subjects'
-- ORDER BY ordinal_position;

