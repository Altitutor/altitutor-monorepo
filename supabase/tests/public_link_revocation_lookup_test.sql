BEGIN;

SELECT plan(10);

SELECT has_function(
  'public',
  'service_is_public_link_revoked',
  ARRAY['text', 'text'],
  'the bounded public-link revocation lookup exists'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.service_is_public_link_revoked(text, text)',
    'EXECUTE'
  ),
  'service_role can execute the bounded lookup'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.service_is_public_link_revoked(text, text)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute the service lookup'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.service_is_public_link_revoked(text, text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the service lookup'
);

SELECT ok(
  NOT has_table_privilege('service_role', 'public.public_link_revocations', 'SELECT'),
  'service_role cannot read bearer-token tombstones directly'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.public_link_revocations', 'SELECT'),
  'authenticated callers cannot read bearer-token tombstones directly'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.public_link_revocations', 'SELECT'),
  'anonymous callers cannot read bearer-token tombstones directly'
);

INSERT INTO public.students (
  id,
  first_name,
  last_name,
  email,
  status
) VALUES (
  'fd000000-0000-4000-8000-000000000020',
  'Revoked',
  'Lookup',
  'revoked-lookup@student.test',
  'TRIAL'
);

INSERT INTO public.public_link_revocations (
  purpose,
  token,
  student_id
) VALUES (
  'REGISTRATION',
  'revoked-registration-token',
  'fd000000-0000-4000-8000-000000000020'
);

SET LOCAL ROLE service_role;

SELECT is(
  public.service_is_public_link_revoked(
    'REGISTRATION',
    'revoked-registration-token'
  ),
  TRUE,
  'service_role can identify a revoked link without reading its row'
);

SELECT is(
  public.service_is_public_link_revoked(
    'REGISTRATION',
    'active-registration-token'
  ),
  FALSE,
  'the lookup returns false for an active link'
);

SELECT is(
  public.service_is_public_link_revoked(
    'BOOKING',
    'revoked-registration-token'
  ),
  FALSE,
  'the lookup keeps registration and booking purposes isolated'
);

SELECT * FROM finish();
ROLLBACK;
