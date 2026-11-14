BEGIN;

SELECT plan(20);

UPDATE public.staff
SET status = 'INACTIVE'
WHERE id = '00000000-0000-0000-0000-000000000002';

INSERT INTO public.student_subscriptions (
  student_id, subject_id, stripe_subscription_id, status, plan_tier, billing_interval
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  public.get_ucat_subject_id(),
  'sub_rpc_caller_scope_lockdowns',
  'trialing',
  'unlimited',
  'year'
);

-- Class enrolment: active AdminStaff through the user client, or the service role.
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.enroll_student_in_class(uuid, uuid, timestamp with time zone, uuid)',
    'EXECUTE'
  ),
  'admin-web can still reach enroll_student_in_class with its user client'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.enroll_student_in_class(uuid, uuid, timestamp with time zone, uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute enroll_student_in_class'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000009',
      NOW(),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'a student cannot enrol a student in a Class'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000009',
      NOW(),
      '00000000-0000-0000-0000-000000000010'
    )
  $$,
  '42501',
  NULL,
  'a tutor cannot enrol a student in a Class'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000009',
      NOW(),
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  NULL,
  'inactive ADMINSTAFF cannot enrol a student in a Class'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000009',
      NOW(),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'active ADMINSTAFF can enrol a student in a Class'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT lives_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000010',
      NOW(),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'the service role can enrol a student in a Class'
);

RESET ROLE;

-- Student absence logging: only the student-web route's service-role client.
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.log_student_absences_self(jsonb, uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute log_student_absences_self'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.log_student_absences_self(jsonb, uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute log_student_absences_self'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.log_student_absences_self(jsonb, uuid)',
    'EXECUTE'
  ),
  'the service role can execute log_student_absences_self'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'private.log_student_absences_self_rows(jsonb, uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute log_student_absences_self_rows'
);

SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'private.log_student_absences_self_rows(jsonb, uuid)',
    'EXECUTE'
  ),
  'log_student_absences_self_rows is reachable only through its public command'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.log_student_absences_self(
      '[]'::jsonb,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  NULL,
  'a signed-in student cannot call log_student_absences_self, even for another student'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT is(
  public.log_student_absences_self(
    '[]'::jsonb,
    '10000000-0000-0000-0000-000000000001'
  )->>'success',
  'true',
  'the student-web service-role path still logs absences'
);

RESET ROLE;

-- UCAT Pro subscription status: service role only.
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.student_has_ucat_pro_subscription(uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute student_has_ucat_pro_subscription'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.student_has_ucat_pro_subscription(uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute student_has_ucat_pro_subscription'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.student_has_ucat_pro_subscription(uuid)',
    'EXECUTE'
  ),
  'the service role can execute student_has_ucat_pro_subscription'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.student_has_ucat_pro_subscription(
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  NULL,
  'a signed-in student cannot call student_has_ucat_pro_subscription, even for another student'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT is(
  public.student_has_ucat_pro_subscription('10000000-0000-0000-0000-000000000002'),
  true,
  'the service role sees a trialing UCAT Pro subscription'
);

SELECT is(
  public.student_has_ucat_pro_subscription('10000000-0000-0000-0000-000000000003'),
  false,
  'the service role sees no UCAT Pro subscription for an unsubscribed student'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
