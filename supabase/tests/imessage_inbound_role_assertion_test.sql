BEGIN;
SELECT plan(4);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT throws_ok($$SELECT public.reconcile_imessage_inbound('{}', '[]', false, false)$$,
  '42501', 'Service role required', 'A service-role SQL session without service JWT is rejected');
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT throws_ok($$SELECT public.reconcile_imessage_inbound('{}', '[]', false, false)$$,
  '42501', 'Service role required', 'An incorrectly claimed JWT role is rejected');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT throws_ok($$SELECT public.reconcile_imessage_inbound('{}', '[]', false, false)$$,
  'P0001', 'Invalid inbound message', 'A service JWT reaches normal payload validation');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT throws_ok($$SELECT public.reconcile_imessage_inbound('{}', '[]', false, false)$$,
  'P0001', 'Invalid inbound message', 'Database administration retains its deliberate postgres allowance');
SELECT * FROM finish();
ROLLBACK;
