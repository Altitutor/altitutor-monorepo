-- Preparation projections depend on Student evidence, profile inputs and the
-- active plan. Keep the snapshot fast path correct when a Student edits their
-- goal or a plan generation/task changes without completing new score evidence.
CREATE OR REPLACE FUNCTION public.get_student_ucat_preparation_evidence_watermark()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH current_student AS (
    SELECT student.id
    FROM public.students student
    WHERE student.user_id = (SELECT auth.uid())
  ), practice_evidence AS (
    SELECT practice.completed_at AS changed_at
    FROM public.student_practice_sessions practice
    JOIN current_student student ON student.id = practice.student_id
    WHERE practice.completed_at IS NOT NULL
    ORDER BY practice.completed_at DESC
    LIMIT 1
  ), set_evidence AS (
    SELECT attempt.completed_at AS changed_at
    FROM public.student_question_set_attempts attempt
    JOIN current_student student ON student.id = attempt.student_id
    WHERE attempt.completed_at IS NOT NULL
    ORDER BY attempt.completed_at DESC
    LIMIT 1
  ), mock_evidence AS (
    SELECT attempt.completed_at AS changed_at
    FROM public.student_ucat_mock_attempts attempt
    JOIN current_student student ON student.id = attempt.student_id
    WHERE attempt.completed_at IS NOT NULL
    ORDER BY attempt.completed_at DESC
    LIMIT 1
  ), profile_input AS (
    SELECT profile.updated_at AS changed_at
    FROM public.ucat_student_study_plan_profiles profile
    JOIN current_student student ON student.id = profile.student_id
    LIMIT 1
  ), active_generation AS (
    SELECT generation.id, generation.generated_at AS changed_at
    FROM public.ucat_student_study_plan_generations generation
    JOIN current_student student ON student.id = generation.student_id
    WHERE generation.superseded_at IS NULL
    LIMIT 1
  ), active_plan_task AS (
    SELECT task.updated_at AS changed_at
    FROM public.ucat_student_study_plan_tasks task
    JOIN active_generation generation ON generation.id = task.generation_id
    ORDER BY task.updated_at DESC
    LIMIT 1
  )
  SELECT max(input.changed_at)
  FROM (
    SELECT changed_at FROM practice_evidence
    UNION ALL
    SELECT changed_at FROM set_evidence
    UNION ALL
    SELECT changed_at FROM mock_evidence
    UNION ALL
    SELECT changed_at FROM profile_input
    UNION ALL
    SELECT changed_at FROM active_generation
    UNION ALL
    SELECT changed_at FROM active_plan_task
  ) input;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_preparation_evidence_watermark()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_preparation_evidence_watermark()
  TO authenticated;
