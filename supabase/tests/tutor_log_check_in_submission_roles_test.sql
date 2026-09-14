BEGIN;
SELECT plan(2);

INSERT INTO public.sessions (
  id,
  type,
  start_at,
  end_at,
  status
)
VALUES (
  'fc110000-0000-4000-8000-000000000001',
  'CHECK_IN',
  now() - interval '1 hour',
  now() - interval '15 minutes',
  'ACTIVE'
);

INSERT INTO public.sessions_staff (session_id, staff_id, type)
VALUES
  (
    'fc110000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'CHECK_IN_HOST'
  ),
  (
    'fc110000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000014',
    'CHECK_IN_RECEIVER'
  );

CREATE TEMP TABLE check_in_log_result AS
SELECT public.create_tutor_log(
  p_session_id => 'fc110000-0000-4000-8000-000000000001',
  p_created_by => '00000000-0000-0000-0000-000000000001',
  p_logged_for_staff_id => '00000000-0000-0000-0000-000000000014'
) AS payload;

SELECT diag((SELECT payload::text FROM check_in_log_result));

SELECT is(
  (SELECT payload ->> 'success' FROM check_in_log_result),
  'true',
  'any adminstaff can submit a check-in log for assigned staff regardless of check-in role'
);

SELECT is(
  (
    SELECT created_by::text || ':' || logged_for_staff_id::text
    FROM public.tutor_logs
    WHERE session_id = 'fc110000-0000-4000-8000-000000000001'
  ),
  '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000014',
  'the log preserves admin submitter and receiving-staff operational attribution separately'
);

SELECT * FROM finish();
ROLLBACK;
