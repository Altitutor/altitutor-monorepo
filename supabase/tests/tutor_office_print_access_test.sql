BEGIN;
SELECT plan(8);

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

SELECT * FROM finish();
ROLLBACK;
