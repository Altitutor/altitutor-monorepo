BEGIN;

SELECT plan(9);

SELECT has_table(
  'public',
  'ucat_preparation_snapshots',
  'Preparation outputs have a lifecycle separate from Study-plan generations'
);
SELECT has_view(
  'public',
  'vstudent_ucat_preparation_snapshots',
  'Preparation snapshots have a Student-readable facade'
);
SELECT has_column(
  'public',
  'ucat_preparation_snapshots',
  'trajectory_model_version',
  'trajectory snapshots record their model version'
);
SELECT col_not_null(
  'public',
  'ucat_preparation_snapshots',
  'snapshot',
  'canonical Preparation output cannot be omitted'
);
SELECT ok(
  has_table_privilege(
    'authenticated',
    'public.vstudent_ucat_preparation_snapshots',
    'SELECT'
  ),
  'Students can read the Preparation snapshot facade'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_student_ucat_preparation_evidence_watermark()',
    'EXECUTE'
  ),
  'Students can read their Preparation freshness watermark'
);

CREATE TEMP TABLE preparation_snapshot_fixture AS
SELECT id AS student_id, user_id
FROM public.students
WHERE user_id IS NOT NULL
ORDER BY id
LIMIT 2;

GRANT SELECT ON preparation_snapshot_fixture TO authenticated;

INSERT INTO public.ucat_preparation_snapshots (
  student_id,
  snapshot_date,
  engine_version,
  policy_version,
  score_model_version,
  trajectory_model_version,
  snapshot,
  generated_at
)
SELECT
  student_id,
  CURRENT_DATE,
  'engine-test-v1',
  'policy-test-v1',
  'score-test-v1',
  'trajectory-test-v1',
  jsonb_build_object('studentId', student_id),
  now()
FROM preparation_snapshot_fixture;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (SELECT user_id FROM preparation_snapshot_fixture OFFSET 1 LIMIT 1),
    'role', 'authenticated'
  )::TEXT,
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vstudent_ucat_preparation_snapshots
    WHERE trajectory_model_version = 'trajectory-test-v1'
  ),
  1::BIGINT,
  'a Student sees only their own Preparation snapshot'
);
SELECT is(
  (
    SELECT snapshot ->> 'studentId'
    FROM public.vstudent_ucat_preparation_snapshots
    WHERE trajectory_model_version = 'trajectory-test-v1'
  ),
  (SELECT student_id::TEXT FROM preparation_snapshot_fixture OFFSET 1 LIMIT 1),
  'the visible snapshot belongs to the authenticated Student'
);

RESET ROLE;

CREATE TEMP TABLE preparation_watermark_fixture AS
SELECT profile.student_id, student.user_id
FROM public.ucat_student_study_plan_profiles profile
JOIN public.students student ON student.id = profile.student_id
WHERE student.user_id IS NOT NULL
ORDER BY profile.id
LIMIT 1;

UPDATE public.ucat_student_study_plan_profiles profile
SET target_score = profile.target_score
FROM preparation_watermark_fixture fixture
WHERE profile.student_id = fixture.student_id;

CREATE TEMP TABLE preparation_watermark_expected AS
SELECT profile.updated_at
FROM public.ucat_student_study_plan_profiles profile
JOIN preparation_watermark_fixture fixture
  ON fixture.student_id = profile.student_id;

GRANT SELECT ON preparation_watermark_fixture TO authenticated;
GRANT SELECT ON preparation_watermark_expected TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (SELECT user_id FROM preparation_watermark_fixture),
    'role', 'authenticated'
  )::TEXT,
  true
);

SELECT ok(
  public.get_student_ucat_preparation_evidence_watermark() >=
    (SELECT updated_at FROM preparation_watermark_expected),
  'profile changes invalidate an older Preparation snapshot'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
