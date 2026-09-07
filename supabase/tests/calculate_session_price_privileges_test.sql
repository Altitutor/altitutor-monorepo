BEGIN;

SELECT plan(3);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.calculate_session_price(uuid, billing_type, timestamp with time zone, timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated students can execute calculate_session_price'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.calculate_session_price(uuid, billing_type, timestamp with time zone, timestamp with time zone)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute calculate_session_price'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.calculate_session_price(uuid, billing_type, timestamp with time zone, timestamp with time zone)',
    'EXECUTE'
  ),
  'service_role can execute calculate_session_price'
);

SELECT * FROM finish();
ROLLBACK;
