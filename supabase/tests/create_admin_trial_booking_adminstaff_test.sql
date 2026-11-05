BEGIN;
SELECT plan(7);

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.create_admin_trial_booking(
    'Dev343Probe',
    'Unauthorized',
    '+61400934343',
    '2030-06-01T00:00:00Z',
    '2030-06-01T01:00:00Z',
    '00000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Active AdminStaff access required',
  'a signed-in student cannot create a trial booking by supplying an AdminStaff user id'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM public.students WHERE first_name = 'Dev343Probe'),
  0,
  'the rejected student call leaves no student row'
);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.create_admin_trial_booking(
    'Dev343Allowed',
    'Admin',
    '+61400934301',
    '2030-06-02T00:00:00Z',
    '2030-06-02T01:00:00Z',
    '00000000-0000-0000-0000-000000000001'
  )$$,
  'active AdminStaff can create a trial booking as themselves'
);
SELECT throws_ok(
  $$SELECT public.create_admin_trial_booking(
    'Dev343Mismatch',
    'Actor',
    '+61400934302',
    '2030-06-03T00:00:00Z',
    '2030-06-03T01:00:00Z',
    '00000000-0000-0000-0000-000000000002'
  )$$,
  '42501',
  'Active AdminStaff access required',
  'active AdminStaff cannot record another staff user as the actor'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM public.students WHERE first_name = 'Dev343Allowed'),
  1,
  'the allowed booking creates the trial student'
);
SELECT is(
  (SELECT count(*)::integer FROM public.students WHERE first_name = 'Dev343Mismatch'),
  0,
  'a mismatched actor creates no student'
);

UPDATE public.staff
SET status = 'INACTIVE'
WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.create_admin_trial_booking(
    'Dev343Inactive',
    'Admin',
    '+61400934303',
    '2030-06-04T00:00:00Z',
    '2030-06-04T01:00:00Z',
    '00000000-0000-0000-0000-000000000002'
  )$$,
  '42501',
  'Active AdminStaff access required',
  'inactive AdminStaff cannot create a trial booking'
);

SELECT * FROM finish();
ROLLBACK;
