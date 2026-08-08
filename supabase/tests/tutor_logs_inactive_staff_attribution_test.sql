BEGIN;
SELECT plan(3);

INSERT INTO public.sessions (
  id,
  type,
  start_at,
  end_at,
  status
)
VALUES (
  'fc100000-0000-4000-8000-000000000001',
  'TRIAL_SESSION',
  now() - interval '1 hour',
  now() - interval '15 minutes',
  'ACTIVE'
);

CREATE TEMP TABLE tutor_log_result AS
SELECT public.create_tutor_log(
  p_session_id => 'fc100000-0000-4000-8000-000000000001',
  p_created_by => '00000000-0000-0000-0000-000000000015'
) AS payload;

SELECT is(
  (SELECT payload ->> 'success' FROM tutor_log_result),
  'true',
  'an admin can attribute a historical tutor log to an inactive staff member'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.tutor_logs
    WHERE session_id = 'fc100000-0000-4000-8000-000000000001'
      AND created_by = '00000000-0000-0000-0000-000000000015'
  ),
  1::bigint,
  'the tutor log retains the selected staff attribution'
);

SELECT is(
  public.create_tutor_log(
    p_session_id => 'fc100000-0000-4000-8000-000000000001',
    p_created_by => '00000000-0000-0000-0000-000000000000'
  ) ->> 'error',
  'Invalid staff member',
  'an unknown staff attribution remains rejected'
);

SELECT * FROM finish();
ROLLBACK;
