BEGIN;
SELECT plan(10);

SELECT has_table('public', 'print_jobs', 'print_jobs table exists');
SELECT has_table('public', 'print_connector_state', 'print_connector_state table exists');
SELECT has_view('public', 'vtutor_print_jobs', 'tutors read print jobs through a view');

SELECT ok(
  has_function_privilege(
    'authenticated',
    'enqueue_print_job(uuid, integer)',
    'EXECUTE'
  ),
  'authenticated can execute enqueue_print_job'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'claim_print_jobs(text, integer)',
    'EXECUTE'
  ),
  'authenticated cannot claim print jobs'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'claim_print_jobs(text, integer)',
    'EXECUTE'
  ),
  'service_role can claim print jobs'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'complete_print_job(uuid, text, text, jsonb, text)',
    'EXECUTE'
  ),
  'authenticated cannot complete print jobs'
);

SELECT is(
  public.is_print_connector_online(),
  false,
  'connector is offline with no heartbeat'
);

SELECT lives_ok(
  $$SELECT public.heartbeat_print_connector('test-print-bridge', 'healthy')$$,
  'postgres can heartbeat the print connector'
);

SELECT is(
  public.is_print_connector_online(),
  true,
  'connector is online after a healthy heartbeat'
);

SELECT * FROM finish();
ROLLBACK;
