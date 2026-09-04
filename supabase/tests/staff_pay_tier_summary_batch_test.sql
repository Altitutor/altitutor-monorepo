BEGIN;

SELECT plan(8);

SELECT has_function(
  'public',
  'get_staff_pay_tier_summary_data',
  ARRAY['uuid[]'],
  'staff pay-tier summary batch function exists'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_staff_pay_tier_summary_data(uuid[])',
    'EXECUTE'
  ),
  'service role can load staff pay-tier summaries'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_staff_pay_tier_summary_data(uuid[])',
    'EXECUTE'
  ),
  'authenticated callers cannot execute the service-only summary function'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_staff_pay_tier_summary_data(uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the staff summary function'
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
VALUES
  (
    'fa730000-0000-4000-8000-000000000001',
    'Batch',
    'Booked',
    'TUTOR',
    'ACTIVE',
    '2025-01-01',
    '{"sessions.HOMEWORK_HELP.any": 4}'::JSONB
  ),
  (
    'fa730000-0000-4000-8000-000000000002',
    'Batch',
    'Logged',
    'TUTOR',
    'ACTIVE',
    '2025-02-01',
    '{}'::JSONB
  );

INSERT INTO public.sessions (id, type, start_at, end_at, status, long_name)
VALUES
  (
    'fa730000-0000-4000-8000-000000000011',
    'CHECK_IN',
    '2026-01-02 09:00:00+10:30',
    '2026-01-02 09:30:00+10:30',
    'ACTIVE',
    'Latest booked check-in'
  ),
  (
    'fa730000-0000-4000-8000-000000000012',
    'CHECK_IN',
    '2026-01-01 09:00:00+10:30',
    '2026-01-01 09:30:00+10:30',
    'ACTIVE',
    'Older logged check-in'
  ),
  (
    'fa730000-0000-4000-8000-000000000013',
    'CHECK_IN',
    '2026-02-01 09:00:00+10:30',
    '2026-02-01 09:30:00+10:30',
    'ACTIVE',
    'Latest legacy check-in'
  );

INSERT INTO public.sessions_staff (id, session_id, staff_id, type)
VALUES (
  'fa730000-0000-4000-8000-000000000021',
  'fa730000-0000-4000-8000-000000000011',
  'fa730000-0000-4000-8000-000000000001',
  'CHECK_IN_RECEIVER'
);

INSERT INTO public.tutor_logs (id, session_id, session_type, created_by)
VALUES
  (
    'fa730000-0000-4000-8000-000000000031',
    'fa730000-0000-4000-8000-000000000012',
    'CHECK_IN',
    'fa730000-0000-4000-8000-000000000001'
  ),
  (
    'fa730000-0000-4000-8000-000000000032',
    'fa730000-0000-4000-8000-000000000013',
    'CHECK_IN',
    'fa730000-0000-4000-8000-000000000002'
  );

INSERT INTO public.tutor_logs_staff_attendance (tutor_log_id, staff_id, type, attended)
VALUES
  (
    'fa730000-0000-4000-8000-000000000031',
    'fa730000-0000-4000-8000-000000000001',
    'CHECK_IN_RECEIVER',
    TRUE
  ),
  (
    'fa730000-0000-4000-8000-000000000032',
    'fa730000-0000-4000-8000-000000000002',
    'CHECK_IN_RECEIVER',
    TRUE
  );

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

CREATE TEMP TABLE staff_summary_data AS
SELECT *
FROM public.get_staff_pay_tier_summary_data(
  ARRAY[
    'fa730000-0000-4000-8000-000000000001'::UUID,
    'fa730000-0000-4000-8000-000000000001'::UUID,
    'fa730000-0000-4000-8000-000000000002'::UUID
  ]
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM staff_summary_data),
  2,
  'duplicate requested staff IDs return one row each'
);

SELECT is(
  (
    SELECT (metrics ->> 'sessions.HOMEWORK_HELP.any')::NUMERIC
    FROM staff_summary_data
    WHERE staff_id = 'fa730000-0000-4000-8000-000000000001'
  ),
  4::NUMERIC,
  'the batch response includes each staff member metrics'
);

SELECT is(
  (
    SELECT last_check_in_session_id
    FROM staff_summary_data
    WHERE staff_id = 'fa730000-0000-4000-8000-000000000001'
  ),
  'fa730000-0000-4000-8000-000000000011'::UUID,
  'the latest check-in is selected across booked and logged sources'
);

SELECT is(
  (
    SELECT last_check_in_session_id
    FROM staff_summary_data
    WHERE staff_id = 'fa730000-0000-4000-8000-000000000002'
  ),
  'fa730000-0000-4000-8000-000000000013'::UUID,
  'legacy-only check-ins are included in the batch response'
);

SELECT * FROM finish();
ROLLBACK;
