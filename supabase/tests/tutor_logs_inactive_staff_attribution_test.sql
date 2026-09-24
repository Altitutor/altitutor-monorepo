BEGIN;
SELECT plan(13);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.create_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'service role can execute tutor-log creation'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.create_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot call tutor-log creation directly'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.update_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'service role can execute tutor-log edits'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.update_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot call tutor-log edits directly'
);

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

INSERT INTO public.sessions_staff (session_id, staff_id, type)
VALUES (
  'fc100000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000015',
  'MAIN_TUTOR'
);

CREATE TEMP TABLE tutor_log_result AS
SELECT public.create_tutor_log(
  p_session_id => 'fc100000-0000-4000-8000-000000000001',
  p_created_by => '00000000-0000-0000-0000-000000000001',
  p_logged_for_staff_id => '00000000-0000-0000-0000-000000000015'
) AS payload;

SELECT is(
  (SELECT payload ->> 'success' FROM tutor_log_result),
  'true',
  'an admin can submit a historical tutor log for an inactive assigned staff member'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.tutor_logs
    WHERE session_id = 'fc100000-0000-4000-8000-000000000001'
      AND created_by = '00000000-0000-0000-0000-000000000001'
      AND logged_for_staff_id = '00000000-0000-0000-0000-000000000015'
  ),
  1::bigint,
  'the tutor log separates the actual submitter from operational attribution'
);

SELECT is(
  public.create_tutor_log(
    p_session_id => 'fc100000-0000-4000-8000-000000000001',
    p_created_by => '00000000-0000-0000-0000-000000000000',
    p_logged_for_staff_id => '00000000-0000-0000-0000-000000000015'
  ) ->> 'error',
  'Invalid submitting staff member',
  'an unknown submitting actor remains rejected'
);

SELECT is(
  public.create_tutor_log(
    p_session_id => 'fc100000-0000-4000-8000-000000000001',
    p_created_by => '00000000-0000-0000-0000-000000000001',
    p_logged_for_staff_id => '00000000-0000-0000-0000-000000000014'
  ) ->> 'error',
  'The staff member logged for must be assigned to the session',
  'an unassigned operational attribution is rejected'
);

SELECT throws_ok(
  $$
    UPDATE public.tutor_logs
    SET created_by = '00000000-0000-0000-0000-000000000002'
    WHERE session_id = 'fc100000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'tutor_log_submitter_is_immutable',
  'the original submitter cannot be changed'
);

CREATE TEMP TABLE tutor_log_update_result AS
SELECT public.update_tutor_log(
  p_tutor_log_id => (
    SELECT id
    FROM public.tutor_logs
    WHERE session_id = 'fc100000-0000-4000-8000-000000000001'
  ),
  p_updated_by => '00000000-0000-0000-0000-000000000002',
  p_logged_for_staff_id => '00000000-0000-0000-0000-000000000015'
) AS payload;

SELECT is(
  (SELECT payload ->> 'success' FROM tutor_log_update_result),
  'true',
  'an authenticated admin actor can atomically edit the log'
);

SELECT is(
  (
    SELECT actor_staff_id
    FROM public.domain_events
    WHERE event_name = 'session.tutor_log_created'
      AND subject_id = 'fc100000-0000-4000-8000-000000000001'
  ),
  '00000000-0000-0000-0000-000000000001'::UUID,
  'the create event records the actual submitter'
);

SELECT is(
  (
    SELECT actor_staff_id
    FROM public.domain_events
    WHERE event_name = 'session.tutor_log_updated'
      AND subject_id = 'fc100000-0000-4000-8000-000000000001'
    ORDER BY recorded_at DESC
    LIMIT 1
  ),
  '00000000-0000-0000-0000-000000000002'::UUID,
  'the update event records the actual editor'
);

SELECT is(
  (
    SELECT updated_by
    FROM public.tutor_logs
    WHERE session_id = 'fc100000-0000-4000-8000-000000000001'
  ),
  '00000000-0000-0000-0000-000000000002'::UUID,
  'the latest editor is stored separately'
);

SELECT * FROM finish();
ROLLBACK;
