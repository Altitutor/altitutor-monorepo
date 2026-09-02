BEGIN;

SELECT plan(12);

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

SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ucat_student_study_plan_exposure_debts',
    'SELECT'
  ),
  'service-role Study-plan generation can read missed exposure debt'
);
SELECT ok(
  NOT has_table_privilege(
    'service_role',
    'public.ucat_student_study_plan_exposure_debts',
    'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
  ),
  'service-role Study-plan generation cannot mutate missed exposure debt'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.ucat_student_study_plan_exposure_debts',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
  )
    AND NOT has_table_privilege(
      'anon',
      'public.ucat_student_study_plan_exposure_debts',
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ),
  'browser roles cannot access missed exposure debt directly'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  'anonymous callers cannot execute public SECURITY DEFINER functions'
);

SELECT * FROM finish();
ROLLBACK;
