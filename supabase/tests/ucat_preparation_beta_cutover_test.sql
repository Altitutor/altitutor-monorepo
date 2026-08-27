BEGIN;

SELECT plan(5);

SELECT ok(
  obj_description('public.ucat_score_projection_snapshots'::regclass) LIKE 'Retired after canonical Preparation cutover:%',
  'legacy score snapshots are explicitly retired'
);
SELECT ok(
  obj_description('public.ucat_score_projection_settings'::regclass) LIKE 'Retired after canonical Preparation cutover:%',
  'legacy score policy settings are explicitly retired'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_score_projection_snapshots
  ),
  0::BIGINT,
  'disposable legacy score snapshots are removed'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_preparation_snapshots
    WHERE engine_version <> 'preparation-engine-v1'
       OR policy_version <> 'evidence-driven-preparation-policy-v7'
       OR score_model_version <> 'pooled-representative-evidence-score-v2'
       OR trajectory_model_version <> 'observed-behavior-trajectory-v2'
  ),
  0::BIGINT,
  'incompatible derived Preparation snapshots are removed'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_student_study_plan_generations
    WHERE superseded_at IS NULL
      AND (
        input_snapshot #>> '{versions,engine}' IS DISTINCT FROM 'preparation-engine-v1'
        OR input_snapshot #>> '{versions,policy}' IS DISTINCT FROM 'evidence-driven-preparation-policy-v7'
        OR input_snapshot #>> '{versions,scoreModel}' IS DISTINCT FROM 'pooled-representative-evidence-score-v2'
        OR input_snapshot #>> '{versions,trajectoryModel}' IS DISTINCT FROM 'observed-behavior-trajectory-v2'
      )
  ),
  0::BIGINT,
  'no incompatible Study-plan generation remains active'
);

SELECT * FROM finish();
ROLLBACK;
