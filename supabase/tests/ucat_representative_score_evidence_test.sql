BEGIN;

SELECT plan(14);

SELECT has_view(
  'public',
  'vstudent_ucat_score_projection_evidence',
  'representative score evidence has a Student-readable facade'
);
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'evidence_session_id', 'evidence exposes its session provenance');
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'prescribed_pace', 'evidence exposes prescribed timing');
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'breadth', 'evidence exposes composition breadth');
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'feedback_withheld', 'evidence exposes feedback conditions');
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'is_student_generated', 'evidence exposes selection provenance');
SELECT has_column('public', 'vstudent_ucat_score_projection_evidence', 'is_standardised', 'evidence exposes standardised-form provenance');
SELECT has_column('public', 'question_sets', 'score_evidence_standardised', 'controlled partial forms can be explicitly approved');
SELECT has_column('public', 'ucat_score_projection_snapshots', 'model_version', 'snapshots record their score-model version');
SELECT col_not_null(
  'public',
  'ucat_score_projection_snapshots',
  'model_version',
  'snapshot model versions cannot be omitted'
);
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_score_projection_evidence'::regclass, true),
  'vstudent_ucat_preparation_timing_evidence',
  'score evidence inherits current-Student scoping from the timing-evidence facade'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.vstudent_ucat_score_projection_evidence', 'SELECT'),
  'authenticated Students can select the score evidence facade'
);

CREATE TEMP TABLE representative_score_rls_question AS
SELECT question.id AS question_id, stem.section_id
FROM public.ucat_questions question
JOIN public.question_stems stem ON stem.id = question.question_stem_id
WHERE question.deleted_at IS NULL
  AND stem.deleted_at IS NULL
ORDER BY question.id
LIMIT 1;

INSERT INTO public.student_practice_sessions (
  id, student_id, ucat_section_id, section_key, filters_snapshot,
  score_points, total_points, question_count, completed_at, was_timed
)
SELECT
  fixture.session_id,
  fixture.student_id,
  question.section_id,
  'representative-score-rls-test',
  '{"timeSpeedMultiplier":1}'::jsonb,
  1,
  1,
  1,
  now(),
  true
FROM representative_score_rls_question question
CROSS JOIN (
  VALUES
    ('fc000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-0000-0000-000000000009'::uuid),
    ('fc000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-0000-0000-000000000010'::uuid)
) AS fixture(session_id, student_id);

INSERT INTO public.student_question_attempts (
  id, student_id, student_practice_session_id, question_id, score, is_submitted
)
SELECT
  CASE session.student_id
    WHEN '10000000-0000-0000-0000-000000000009'::uuid
      THEN 'fd000000-0000-4000-8000-000000000001'::uuid
    ELSE 'fd000000-0000-4000-8000-000000000002'::uuid
  END,
  session.student_id,
  session.id,
  question.question_id,
  1,
  true
FROM public.student_practice_sessions session
CROSS JOIN representative_score_rls_question question
WHERE session.id IN (
  'fc000000-0000-4000-8000-000000000001',
  'fc000000-0000-4000-8000-000000000002'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vstudent_ucat_score_projection_evidence
    WHERE evidence_session_id IN (
      'fc000000-0000-4000-8000-000000000001',
      'fc000000-0000-4000-8000-000000000002'
    )
  ),
  1::bigint,
  'a Student sees only one of two Students score-evidence rows'
);
SELECT is(
  (
    SELECT max(evidence_session_id)
    FROM public.vstudent_ucat_score_projection_evidence
    WHERE evidence_session_id IN (
      'fc000000-0000-4000-8000-000000000001',
      'fc000000-0000-4000-8000-000000000002'
    )
  ),
  'fc000000-0000-4000-8000-000000000002',
  'the visible score evidence belongs to the authenticated Student'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
