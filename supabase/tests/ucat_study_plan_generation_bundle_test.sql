BEGIN;
SELECT plan(6);

INSERT INTO public.student_question_set_attempts (
  id, student_id, question_set_id, content_snapshot
)
SELECT
  'fa000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000010',
  question_set.id,
  '{}'::JSONB
FROM public.question_sets question_set
LIMIT 1;

UPDATE public.student_question_set_attempts
SET completed_at = timestamptz '2026-08-20 00:00:00+00'
WHERE id = 'fa000000-0000-4000-8000-000000000001';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.student_ucat_completed_benchmark_assets asset
    WHERE asset.student_id = '10000000-0000-0000-0000-000000000010'
      AND asset.asset_type = 'set'
      AND asset.last_completed_at = timestamptz '2026-08-20 00:00:00+00'
  ),
  'standalone Set completion projects one latest asset fact'
);

UPDATE public.student_question_set_attempts
SET completed_at = NULL,
  discarded_at = timestamptz '2026-08-21 00:00:00+00'
WHERE id = 'fa000000-0000-4000-8000-000000000001';

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.student_ucat_completed_benchmark_assets asset
    WHERE asset.student_id = '10000000-0000-0000-0000-000000000010'
      AND asset.asset_type = 'set'
  ),
  'discarding the only completion removes its projected asset fact'
);

INSERT INTO public.student_ucat_completed_benchmark_assets (
  student_id, asset_type, asset_id, last_completed_at
)
SELECT
  '10000000-0000-0000-0000-000000000010',
  asset_type,
  md5(asset_type || series::TEXT)::UUID,
  timestamptz '2026-01-01 00:00:00+00' + make_interval(secs => series)
FROM unnest(ARRAY['set', 'mock']) asset_type
CROSS JOIN generate_series(1, 600) series;

CREATE TEMP TABLE scheduled_bundle AS
SELECT public.get_student_ucat_study_plan_generation_bundle(
  '10000000-0000-0000-0000-000000000010'
) AS value;

SELECT is(
  (SELECT jsonb_typeof(value) FROM scheduled_bundle),
  'object',
  'scheduled generation returns one Student-scoped bundle'
);

SELECT ok(
  (SELECT jsonb_typeof(value -> 'vstudent_ucat_practice_stem_index') = 'array'
    AND jsonb_typeof(value -> 'vstudent_ucat_my_question_attempts') = 'array'
    AND jsonb_typeof(value -> 'vstudent_ucat_preparation_snapshots') = 'array'
   FROM scheduled_bundle),
  'the canonical catalogue, evidence, and snapshot inputs are arrays'
);

SELECT ok(
  (SELECT jsonb_array_length(value -> 'vstudent_ucat_my_question_attempts') <= 5000
    AND jsonb_array_length(value -> 'vstudent_ucat_preparation_timing_evidence') <= 800
    AND jsonb_array_length(value -> 'vstudent_ucat_completed_set_assets') = 512
    AND jsonb_array_length(value -> 'vstudent_ucat_completed_mock_assets') = 512
   FROM scheduled_bundle),
  'lifetime evidence and completed benchmark inputs are explicitly bounded'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_student_ucat_study_plan_generation_bundle(uuid)',
    'EXECUTE'
  ),
  'Students cannot invoke the cross-Student scheduled bundle'
);

SELECT * FROM finish();
ROLLBACK;
