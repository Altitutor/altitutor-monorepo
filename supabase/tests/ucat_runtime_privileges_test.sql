BEGIN;

SELECT plan(8);

SELECT ok(
  has_table_privilege('authenticated', 'public.vstudent_profile', 'SELECT'),
  'authenticated students can read their profile view'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.vstudent_profile', 'SELECT'),
  'anonymous callers cannot read the student profile view'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.vstudent_profile',
    'INSERT, UPDATE, DELETE'
  ),
  'authenticated students cannot mutate the student profile view'
);
SELECT ok(
  has_table_privilege(
    'authenticated',
    'public.vstudent_ucat_my_access',
    'SELECT'
  ),
  'authenticated students can read their UCAT access view'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.vstudent_ucat_my_access', 'SELECT'),
  'anonymous callers cannot read the UCAT access view'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.vstudent_ucat_my_access',
    'INSERT, UPDATE, DELETE'
  ),
  'authenticated students cannot mutate the UCAT access view'
);
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ucat_public_question_counts_cache',
    'SELECT'
  ),
  'service-role study-plan workers can read cached question counts'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.ucat_public_question_counts_cache',
    'SELECT'
  )
    AND NOT has_table_privilege(
      'anon',
      'public.ucat_public_question_counts_cache',
      'SELECT'
    ),
  'browser roles cannot read the shared counts cache directly'
);

SELECT * FROM finish();
ROLLBACK;
