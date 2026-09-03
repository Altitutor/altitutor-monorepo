BEGIN;
SELECT plan(10);

SELECT has_enum(
  'public',
  'staff_pay_tier_requirement_kind',
  'pay-tier requirement kind enum exists'
);

SELECT enum_has_labels(
  'public',
  'staff_pay_tier_requirement_kind',
  ARRAY[
    'TENURE_DAYS',
    'TENURE_MONTHS',
    'SESSION_COUNT',
    'TIME_SINCE_LAST_PROMOTION',
    'RESOURCE_COUNT'
  ],
  'resource counts are a first-class pay-tier requirement'
);

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
  'fa710000-0000-4000-8000-000000000001',
  'Pay Tier',
  'Metrics Test',
  'TUTOR',
  'ACTIVE',
  '2025-01-01',
  '{}'::jsonb
);

INSERT INTO public.subjects (id, name, short_name, long_name, curriculum, discipline)
VALUES (
  'fa710000-0000-4000-8000-000000000002',
  'Homework Help',
  'HOME',
  'Homework Help',
  'PRESACE',
  'MATHEMATICS'
);

UPDATE public.staff
SET metric_overrides = jsonb_build_object(
  'sessions.CLASS.MAIN_TUTOR', 2,
  'sessions.HOMEWORK_HELP.any', 4,
  'sessions.ADMIN_SHIFT.any', 3,
  public.staff_tier_resource_metric_key(
    'NOTES',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002')
  ), 2,
  public.staff_tier_resource_metric_key('UNKNOWN', NULL), 3
)
WHERE id = 'fa710000-0000-4000-8000-000000000001';

INSERT INTO public.files (
  id, mimetype, filename, size_bytes, storage_provider, bucket, storage_path, created_by
)
VALUES
  (
    'fa710000-0000-4000-8000-000000000011',
    'application/pdf',
    'pay-tier-notes.pdf',
    100,
    'supabase',
    'resources',
    'tests/pay-tier-notes.pdf',
    'fa710000-0000-4000-8000-000000000001'
  ),
  (
    'fa710000-0000-4000-8000-000000000012',
    'application/pdf',
    'pay-tier-solutions.pdf',
    100,
    'supabase',
    'resources',
    'tests/pay-tier-solutions.pdf',
    'fa710000-0000-4000-8000-000000000001'
  );

INSERT INTO public.topics_files (
  id, topic_id, type, file_id, is_solutions, created_by
)
VALUES
  (
    'fa710000-0000-4000-8000-000000000021',
    '30000000-0000-0000-0000-000000000002',
    'NOTES',
    'fa710000-0000-4000-8000-000000000011',
    FALSE,
    'fa710000-0000-4000-8000-000000000001'
  ),
  (
    'fa710000-0000-4000-8000-000000000022',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'fa710000-0000-4000-8000-000000000012',
    TRUE,
    'fa710000-0000-4000-8000-000000000001'
  );

INSERT INTO public.sessions (id, type, subject_id, start_at, end_at, status)
VALUES
  (
    'fa710000-0000-4000-8000-000000000031',
    'CLASS',
    'fa710000-0000-4000-8000-000000000002',
    now() - interval '2 hours',
    now() - interval '1 hour',
    'ACTIVE'
  ),
  (
    'fa710000-0000-4000-8000-000000000032',
    'CLASS',
    (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002'),
    now() - interval '4 hours',
    now() - interval '3 hours',
    'ACTIVE'
  );

INSERT INTO public.tutor_logs (id, session_id, session_type, created_by)
VALUES
  (
    'fa710000-0000-4000-8000-000000000041',
    'fa710000-0000-4000-8000-000000000031',
    'CLASS',
    'fa710000-0000-4000-8000-000000000001'
  ),
  (
    'fa710000-0000-4000-8000-000000000042',
    'fa710000-0000-4000-8000-000000000032',
    'CLASS',
    'fa710000-0000-4000-8000-000000000001'
  );

INSERT INTO public.tutor_logs_staff_attendance (
  tutor_log_id, staff_id, type, attended
)
VALUES
  (
    'fa710000-0000-4000-8000-000000000041',
    'fa710000-0000-4000-8000-000000000001',
    'MAIN_TUTOR',
    TRUE
  ),
  (
    'fa710000-0000-4000-8000-000000000042',
    'fa710000-0000-4000-8000-000000000001',
    'MAIN_TUTOR',
    TRUE
  );

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE TEMP TABLE computed_metrics AS
SELECT public.compute_staff_tier_metrics(
  'fa710000-0000-4000-8000-000000000001'
) AS metrics;

SELECT is(
  (SELECT (metrics ->> 'sessions.HOMEWORK_HELP.any')::numeric FROM computed_metrics),
  5::numeric,
  'Homework Help database sessions and legacy overrides are added together'
);

SELECT is(
  (SELECT (metrics ->> 'sessions.CLASS.MAIN_TUTOR')::numeric FROM computed_metrics),
  3::numeric,
  'Homework Help does not inflate role-specific class counts'
);

SELECT is(
  (SELECT (metrics ->> 'sessions.CLASS.any')::numeric FROM computed_metrics),
  3::numeric,
  'class any-role metrics are derived after legacy role overrides'
);

SELECT is(
  (SELECT (metrics ->> 'sessions.teaching.all')::numeric FROM computed_metrics),
  3::numeric,
  'Homework Help is excluded from the teaching aggregate'
);

SELECT is(
  (SELECT (metrics ->> 'sessions.admin.all')::numeric FROM computed_metrics),
  3::numeric,
  'legacy admin shifts contribute to the admin aggregate'
);

SELECT is(
  (
    SELECT (
      metrics ->> public.staff_tier_resource_metric_key(
        'NOTES',
        (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002')
      )
    )::numeric
    FROM computed_metrics
  ),
  3::numeric,
  'database and legacy resources are added within their subject and type'
);

SELECT is(
  (
    SELECT (
      metrics ->> public.staff_tier_resource_metric_key(
        'SOLUTIONS',
        (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002')
      )
    )::numeric
    FROM computed_metrics
  ),
  1::numeric,
  'solution files use the exclusive Solutions category'
);

SELECT ok(
  NOT (
    SELECT metrics ? public.staff_tier_resource_metric_key(
      'TEST',
      (SELECT subject_id FROM public.topics WHERE id = '30000000-0000-0000-0000-000000000002')
    )
    FROM computed_metrics
  ),
  'solution files are not also counted under their database resource type'
);

SELECT * FROM finish();
ROLLBACK;
