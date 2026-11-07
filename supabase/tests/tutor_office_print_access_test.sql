BEGIN;
SELECT plan(11);

SELECT has_table('public', 'office_print_settings', 'office_print_settings table exists');
SELECT has_view('public', 'vtutor_office_print_settings', 'tutors read office print settings through a view');
SELECT has_function('public', 'tutor_may_office_print', ARRAY[]::text[], 'tutor_may_office_print exists');

SELECT is(
  (SELECT tutor_access::text FROM public.office_print_settings WHERE singleton),
  'office_hours',
  'default tutor office print access is office hours'
);

SELECT is(
  public.tutor_may_office_print(),
  false,
  'office hours blocks tutors when no admin shift is active'
);

UPDATE public.office_print_settings
SET tutor_access = 'unrestricted'
WHERE singleton;

SELECT is(
  public.tutor_may_office_print(),
  true,
  'unrestricted allows tutors even when no admin shift is active'
);

UPDATE public.office_print_settings
SET tutor_access = 'off'
WHERE singleton;

SELECT is(
  public.tutor_may_office_print(),
  false,
  'off blocks tutors even when no other gates apply'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'tutor_may_office_print()',
    'EXECUTE'
  ),
  'authenticated can execute tutor_may_office_print'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.vtutor_office_print_settings', 'UPDATE'),
  'the print settings view is read-only'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT results_eq(
  'SELECT tutor_access::text, connector_online, window_open FROM public.vtutor_office_print_settings',
  $$ SELECT 'off'::text, public.is_print_connector_online(), public.is_office_print_window_open() $$,
  'tutor print settings include the current mode, connector status and print window'
);

SELECT set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is_empty('SELECT * FROM public.vtutor_office_print_settings',
  'students cannot read the tutor print settings view');

SELECT * FROM finish();
ROLLBACK;
