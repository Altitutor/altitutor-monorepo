-- Migration: Drop classes.subject column and update student views
-- Description:
--  1. Drop the legacy 'subject' TEXT column from classes table (replaced by subject_id UUID)
--  2. Rename vstudent_session_base to vstudent_session_detail
--  3. Drop vstudent_subject_resources view
--  4. Create vstudent_topics and vstudent_topics_files views (similar to vtutor_ views)

-- ================================================
-- DROP LEGACY SUBJECT COLUMN FROM CLASSES
-- ================================================
ALTER TABLE public.classes DROP COLUMN IF EXISTS subject;

-- ================================================
-- RENAME VSTUDENT_SESSION_BASE TO VSTUDENT_SESSION_DETAIL
-- ================================================
DROP VIEW IF EXISTS public.vstudent_session_base CASCADE;

-- Recreate with new name (using the same definition from fix_student_views_security.sql)
CREATE VIEW public.vstudent_session_detail
WITH (security_invoker = false)
AS
SELECT
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Other students in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_detail TO authenticated;

COMMENT ON VIEW public.vstudent_session_detail IS 'Student view: Detailed session information (security_definer)';

-- ================================================
-- DROP VSTUDENT_SUBJECT_RESOURCES VIEW
-- ================================================
DROP VIEW IF EXISTS public.vstudent_subject_resources CASCADE;

-- ================================================
-- CREATE VSTUDENT_TOPICS VIEW
-- All topics for the student's authorized subjects
-- ================================================
CREATE OR REPLACE VIEW public.vstudent_topics
WITH (security_invoker = false)
AS
SELECT 
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
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

-- ================================================
-- CREATE VSTUDENT_TOPICS_FILES VIEW
-- All topics_files for the student's authorized topics
-- ================================================
CREATE OR REPLACE VIEW public.vstudent_topics_files
WITH (security_invoker = false)
AS
SELECT 
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
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

