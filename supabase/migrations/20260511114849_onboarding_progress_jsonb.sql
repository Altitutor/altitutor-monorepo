-- Migration: Onboarding progress JSONB on students
-- Description:
--   Move from a single `welcome_modal_acknowledged_at` timestamp to a
--   per-tour JSONB blob `onboarding_progress` so client apps (student-web,
--   ucat-web) can track multiple onboarding flows independently and sync
--   across devices.
--
--   Shape:
--     {
--       "<tour_id>": { "completed_at": "<ISO8601>", "version": <int> },
--       ...
--     }
--
--   Migration steps:
--     1. Add new JSONB column with object-typed default.
--     2. Backfill the legacy welcome_modal_acknowledged_at into the new shape
--        under the tour id `student-welcome`.
--     3. Drop the legacy column.
--     4. Recreate vstudent_profile (it currently exposes the dropped column).
--     5. Add SECURITY DEFINER RPCs students can call to mark a tour complete,
--        reset a single tour, or reset all tours (used for "replay" buttons).

-- ================================================
-- 1. ADD onboarding_progress JSONB
-- ================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.students
  ADD CONSTRAINT students_onboarding_progress_is_object
  CHECK (jsonb_typeof(onboarding_progress) = 'object');

COMMENT ON COLUMN public.students.onboarding_progress IS
  'Per-tour onboarding completion map: { "<tour_id>": { "completed_at": "<ISO8601>", "version": <int> } }. Written via student_complete_onboarding_tour RPC; read directly via vstudent_profile.';

-- ================================================
-- 2. BACKFILL FROM welcome_modal_acknowledged_at
-- ================================================
UPDATE public.students
SET onboarding_progress = jsonb_build_object(
  'student-welcome',
  jsonb_build_object(
    'completed_at', to_char(welcome_modal_acknowledged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'version', 1
  )
)
WHERE welcome_modal_acknowledged_at IS NOT NULL;

-- ================================================
-- 3. RECREATE vstudent_profile (current definition references the column we are about to drop)
-- ================================================
DROP VIEW IF EXISTS public.vstudent_profile CASCADE;

CREATE VIEW public.vstudent_profile
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.status,
  s.user_id,
  s.school,
  s.curriculum,
  s.year_level,
  s.availability_monday,
  s.availability_tuesday,
  s.availability_wednesday,
  s.availability_thursday,
  s.availability_friday,
  s.availability_saturday_am,
  s.availability_saturday_pm,
  s.availability_sunday_am,
  s.availability_sunday_pm,
  s.created_at,
  s.updated_at,
  s.onboarding_progress
FROM public.students s
WHERE s.id = public.current_student_id();

GRANT SELECT ON public.vstudent_profile TO authenticated;

COMMENT ON VIEW public.vstudent_profile IS
  'Student view: Own profile information including onboarding_progress (security_invoker = false)';

-- ================================================
-- 4. DROP legacy column
-- ================================================
ALTER TABLE public.students
  DROP COLUMN IF EXISTS welcome_modal_acknowledged_at;

-- ================================================
-- 5. RPCs FOR STUDENTS
--    The students table has no UPDATE RLS for students (admin-only direct
--    access), so writes must go through SECURITY DEFINER functions. Each
--    function self-checks `current_student_id()` so a student can only ever
--    mutate their own row.
-- ================================================

CREATE OR REPLACE FUNCTION public.student_complete_onboarding_tour(
  p_tour_id TEXT,
  p_version INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_now TIMESTAMPTZ := now();
  v_completed_at_iso TEXT := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_result JSONB;
BEGIN
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a student';
  END IF;

  IF p_tour_id IS NULL OR length(trim(p_tour_id)) = 0 THEN
    RAISE EXCEPTION 'tour_id is required';
  END IF;

  UPDATE public.students
  SET onboarding_progress = COALESCE(onboarding_progress, '{}'::jsonb)
        || jsonb_build_object(
             p_tour_id,
             jsonb_build_object(
               'completed_at', v_completed_at_iso,
               'version', COALESCE(p_version, 1)
             )
           )
  WHERE id = v_student_id
  RETURNING onboarding_progress INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.student_complete_onboarding_tour(TEXT, INTEGER) IS
  'Mark an onboarding tour completed for the current student. Merges {tour_id: {completed_at, version}} into students.onboarding_progress.';

GRANT EXECUTE ON FUNCTION public.student_complete_onboarding_tour(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_reset_onboarding_tour(p_tour_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_result JSONB;
BEGIN
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a student';
  END IF;

  IF p_tour_id IS NULL OR length(trim(p_tour_id)) = 0 THEN
    RAISE EXCEPTION 'tour_id is required';
  END IF;

  UPDATE public.students
  SET onboarding_progress = COALESCE(onboarding_progress, '{}'::jsonb) - p_tour_id
  WHERE id = v_student_id
  RETURNING onboarding_progress INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.student_reset_onboarding_tour(TEXT) IS
  'Clear completion for a single onboarding tour for the current student.';

GRANT EXECUTE ON FUNCTION public.student_reset_onboarding_tour(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_reset_onboarding_progress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_result JSONB;
BEGIN
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a student';
  END IF;

  UPDATE public.students
  SET onboarding_progress = '{}'::jsonb
  WHERE id = v_student_id
  RETURNING onboarding_progress INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.student_reset_onboarding_progress() IS
  'Clear all onboarding tour completion flags for the current student.';

GRANT EXECUTE ON FUNCTION public.student_reset_onboarding_progress() TO authenticated;
