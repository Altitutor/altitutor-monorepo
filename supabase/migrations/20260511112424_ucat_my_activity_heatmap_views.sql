-- Migration: UCAT student activity heatmap views
-- Description:
--   Adds two lightweight views that drive the dashboard "Review heatmap":
--     1. vstudent_ucat_my_activity_daily   – one row per day with question/set
--                                            attempt counts, bucketed in the
--                                            student's saved timezone.
--     2. vstudent_ucat_my_activity_start   – earliest "first time using UCAT"
--                                            marker for the current student.
--                                            Used to clamp the heatmap to the
--                                            point in time the student first
--                                            logged into ucat-web / had access.
--   These let the heatmap render from a tiny payload (~daily rows) instead of
--   piggy-backing on the heavy /api/ucat/progress endpoint which ships every
--   question/set/mock/practice attempt to the client.
-- Date: 2026-05-11

-- =========================================================================
-- 1) Daily activity buckets in the student's local timezone
-- =========================================================================
CREATE OR REPLACE VIEW public.vstudent_ucat_my_activity_daily
WITH (security_invoker = false)
AS
WITH student_tz AS (
  SELECT s.timezone
  FROM public.students s
  WHERE s.id = public.current_student_id()
  LIMIT 1
),
question_days AS (
  SELECT
    (sqa.attempted_at AT TIME ZONE (SELECT timezone FROM student_tz))::date AS activity_date,
    COUNT(*)::int AS question_attempts
  FROM public.student_question_attempts sqa
  WHERE sqa.student_id = public.current_student_id()
    AND sqa.is_submitted = true
    AND sqa.attempted_at IS NOT NULL
  GROUP BY 1
),
set_days AS (
  SELECT
    (sqsa.completed_at AT TIME ZONE (SELECT timezone FROM student_tz))::date AS activity_date,
    COUNT(*)::int AS set_attempts
  FROM public.student_question_set_attempts sqsa
  WHERE sqsa.student_id = public.current_student_id()
    AND sqsa.completed_at IS NOT NULL
  GROUP BY 1
)
SELECT
  COALESCE(qd.activity_date, sd.activity_date) AS activity_date,
  COALESCE(qd.question_attempts, 0)::int AS question_attempts,
  COALESCE(sd.set_attempts, 0)::int AS set_attempts
FROM question_days qd
FULL OUTER JOIN set_days sd ON sd.activity_date = qd.activity_date
WHERE public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_my_activity_daily TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_activity_daily IS
  'Per-day question/set attempt counts for the current UCAT student. Days are bucketed in the student''s timezone (students.timezone). Powers the dashboard Review heatmap.';

-- =========================================================================
-- 2) Earliest "started using UCAT" timestamp
--    Resolves to the earliest of:
--      * subscription created_at (online access granted)
--      * UCAT class enrollment enrolled_at (in-person access granted)
--      * earliest question / set / mock / practice activity
--    NULL if none (the WHERE clause already excludes non-UCAT students).
-- =========================================================================
CREATE OR REPLACE VIEW public.vstudent_ucat_my_activity_start
WITH (security_invoker = false)
AS
SELECT
  public.current_student_id() AS student_id,
  LEAST(
    (SELECT MIN(ss.created_at)
       FROM public.student_subscriptions ss
      WHERE ss.student_id = public.current_student_id()
        AND ss.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)),
    (SELECT MIN(cs.enrolled_at)
       FROM public.classes_students cs
       JOIN public.classes c ON c.id = cs.class_id
      WHERE cs.student_id = public.current_student_id()
        AND c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)),
    (SELECT MIN(sqa.attempted_at)
       FROM public.student_question_attempts sqa
      WHERE sqa.student_id = public.current_student_id()
        AND sqa.attempted_at IS NOT NULL),
    (SELECT MIN(sqsa.attempted_at)
       FROM public.student_question_set_attempts sqsa
      WHERE sqsa.student_id = public.current_student_id()
        AND sqsa.attempted_at IS NOT NULL),
    (SELECT MIN(suma.attempted_at)
       FROM public.student_ucat_mock_attempts suma
      WHERE suma.student_id = public.current_student_id()
        AND suma.attempted_at IS NOT NULL),
    (SELECT MIN(sps.started_at)
       FROM public.student_practice_sessions sps
      WHERE sps.student_id = public.current_student_id()
        AND sps.started_at IS NOT NULL)
  ) AS started_at,
  s.timezone
FROM public.students s
WHERE s.id = public.current_student_id()
  AND public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_my_activity_start TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_activity_start IS
  'Earliest UCAT touchpoint (subscription, class enrollment, or first attempt) for the current student. Used to clamp the heatmap window so it only shows from the moment they first joined / used the UCAT product.';
