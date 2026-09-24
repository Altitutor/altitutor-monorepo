BEGIN;

SELECT plan(5);

INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  role,
  status,
  employment_started_at,
  metric_overrides
)
VALUES (
  'fa740000-0000-4000-8000-000000000001',
  'Counting',
  'Test',
  'TUTOR',
  'ACTIVE',
  '2026-01-01',
  '{}'::JSONB
);

INSERT INTO public.sessions (id, type, subject_id, start_at, end_at, status)
VALUES
  (
    'fa740000-0000-4000-8000-000000000011',
    'CLASS',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002'),
    NOW() - INTERVAL '10 hours',
    NOW() - INTERVAL '9 hours',
    'ACTIVE'
  ),
  (
    'fa740000-0000-4000-8000-000000000012',
    'CLASS',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002'),
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '7 hours',
    'ACTIVE'
  ),
  (
    'fa740000-0000-4000-8000-000000000013',
    'CLASS',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002'),
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '5 hours',
    'ACTIVE'
  ),
  (
    'fa740000-0000-4000-8000-000000000014',
    'CLASS',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002'),
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '3 hours',
    'ACTIVE'
  ),
  (
    'fa740000-0000-4000-8000-000000000015',
    'HOMEWORK_HELP',
    NULL,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour',
    'ACTIVE'
  );

INSERT INTO public.sessions_staff (session_id, staff_id, type)
VALUES
  (
    'fa740000-0000-4000-8000-000000000014',
    'fa740000-0000-4000-8000-000000000001',
    'SECONDARY_TUTOR'
  ),
  (
    'fa740000-0000-4000-8000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'MAIN_TUTOR'
  ),
  (
    'fa740000-0000-4000-8000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'MAIN_TUTOR'
  ),
  (
    'fa740000-0000-4000-8000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'MAIN_TUTOR'
  ),
  (
    'fa740000-0000-4000-8000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    'MAIN_TUTOR'
  );

INSERT INTO public.sessions_students (session_id, student_id)
VALUES
  (
    'fa740000-0000-4000-8000-000000000012',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    'fa740000-0000-4000-8000-000000000013',
    '10000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.tutor_logs (
  id, session_id, session_type, created_by, logged_for_staff_id
)
VALUES
  (
    'fa740000-0000-4000-8000-000000000021',
    'fa740000-0000-4000-8000-000000000011',
    'CLASS',
    'fa740000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'fa740000-0000-4000-8000-000000000022',
    'fa740000-0000-4000-8000-000000000012',
    'CLASS',
    'fa740000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'fa740000-0000-4000-8000-000000000023',
    'fa740000-0000-4000-8000-000000000013',
    'CLASS',
    'fa740000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'fa740000-0000-4000-8000-000000000025',
    'fa740000-0000-4000-8000-000000000015',
    'HOMEWORK_HELP',
    'fa740000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.tutor_logs_staff_attendance (tutor_log_id, staff_id, type, attended)
SELECT
  tutor_log_id,
  'fa740000-0000-4000-8000-000000000001',
  'MAIN_TUTOR',
  TRUE
FROM unnest(ARRAY[
  'fa740000-0000-4000-8000-000000000021'::UUID,
  'fa740000-0000-4000-8000-000000000022'::UUID,
  'fa740000-0000-4000-8000-000000000023'::UUID,
  'fa740000-0000-4000-8000-000000000025'::UUID
]) AS tutor_log_id;

INSERT INTO public.tutor_logs_student_attendance (
  tutor_log_id,
  student_id,
  attended,
  created_by
)
VALUES
  (
    'fa740000-0000-4000-8000-000000000022',
    '10000000-0000-0000-0000-000000000001',
    FALSE,
    'fa740000-0000-4000-8000-000000000001'
  ),
  (
    'fa740000-0000-4000-8000-000000000023',
    '10000000-0000-0000-0000-000000000001',
    TRUE,
    'fa740000-0000-4000-8000-000000000001'
  );

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

CREATE TEMP TABLE computed_attended_class_metrics AS
SELECT public.compute_staff_tier_metrics(
  'fa740000-0000-4000-8000-000000000001'
) AS metrics;

SELECT is(
  (
    SELECT (metrics ->> 'sessions.CLASS.MAIN_TUTOR')::NUMERIC
    FROM computed_attended_class_metrics
  ),
  1::NUMERIC,
  'only a logged Class with an attending Student counts'
);

SELECT is(
  (
    SELECT (metrics ->> 'sessions.CLASS.any')::NUMERIC
    FROM computed_attended_class_metrics
  ),
  1::NUMERIC,
  'the Class any-role total excludes empty and all-absent logs'
);

SELECT is(
  (
    SELECT (metrics ->> 'sessions.teaching.all')::NUMERIC
    FROM computed_attended_class_metrics
  ),
  1::NUMERIC,
  'the teaching total excludes empty and all-absent Classes'
);

SELECT ok(
  NOT (
    SELECT metrics ? 'sessions.CLASS.SECONDARY_TUTOR'
    FROM computed_attended_class_metrics
  ),
  'an unlogged past Class does not count'
);

SELECT is(
  (
    SELECT (metrics ->> 'sessions.HOMEWORK_HELP.any')::NUMERIC
    FROM computed_attended_class_metrics
  ),
  1::NUMERIC,
  'logged Homework Help counts without Student attendance'
);

SELECT * FROM finish();

ROLLBACK;
