-- ALTI-556 is a beta cutover: future derived state is disposable, while
-- completed task and attempt history remains available for evidence and audit.
WITH incompatible_active_generations AS (
  SELECT id
  FROM public.ucat_student_study_plan_generations
  WHERE superseded_at IS NULL
    AND (
      input_snapshot #>> '{versions,engine}' IS DISTINCT FROM 'preparation-engine-v1'
      OR input_snapshot #>> '{versions,policy}' IS DISTINCT FROM 'evidence-driven-preparation-policy-v5'
      OR input_snapshot #>> '{versions,scoreModel}' IS DISTINCT FROM 'representative-evidence-score-v1'
      OR input_snapshot #>> '{versions,trajectoryModel}' IS DISTINCT FROM 'conditional-preparation-trajectory-v1'
    )
)
DELETE FROM public.ucat_student_study_plan_tasks task
USING incompatible_active_generations generation
WHERE task.generation_id = generation.id
  AND task.scheduled_date >= CURRENT_DATE
  AND task.status IN ('planned', 'partial');

UPDATE public.ucat_student_study_plan_generations
SET superseded_at = now()
WHERE superseded_at IS NULL
  AND (
    input_snapshot #>> '{versions,engine}' IS DISTINCT FROM 'preparation-engine-v1'
    OR input_snapshot #>> '{versions,policy}' IS DISTINCT FROM 'evidence-driven-preparation-policy-v5'
    OR input_snapshot #>> '{versions,scoreModel}' IS DISTINCT FROM 'representative-evidence-score-v1'
    OR input_snapshot #>> '{versions,trajectoryModel}' IS DISTINCT FROM 'conditional-preparation-trajectory-v1'
  );

DELETE FROM public.ucat_student_next_steps;

DELETE FROM public.ucat_preparation_snapshots
WHERE engine_version <> 'preparation-engine-v1'
   OR policy_version <> 'evidence-driven-preparation-policy-v5'
   OR score_model_version <> 'representative-evidence-score-v1'
   OR trajectory_model_version <> 'conditional-preparation-trajectory-v1';

DELETE FROM public.ucat_score_projection_snapshots;

COMMENT ON TABLE public.ucat_score_projection_snapshots IS
  'Retired after canonical Preparation cutover: retained temporarily as an empty compatibility relation; application code no longer reads or writes it.';
COMMENT ON TABLE public.ucat_score_projection_settings IS
  'Retired after canonical Preparation cutover: policy now belongs to the versioned canonical Preparation engine.';
