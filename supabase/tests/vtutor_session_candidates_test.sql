BEGIN;
SELECT plan(9);

SELECT columns_are('public', 'vtutor_session_student_candidates',
  ARRAY['id','first_name','last_name','status'], 'student candidates expose names and status only');
SELECT columns_are('public', 'vtutor_session_staff_candidates',
  ARRAY['id','first_name','last_name','role','status'], 'staff candidates expose names, role and status only');

SELECT ok(
  NOT has_table_privilege('anon', 'public.vtutor_session_student_candidates', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.vtutor_session_staff_candidates', 'SELECT'),
  'anonymous callers cannot read the candidate views'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.vtutor_session_student_candidates', 'INSERT, UPDATE, DELETE')
  AND NOT has_table_privilege('authenticated', 'public.vtutor_session_staff_candidates', 'INSERT, UPDATE, DELETE'),
  'candidate views cannot write to participant base tables'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT id::text FROM public.vtutor_session_student_candidates
     WHERE id IN ('10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000005',
                  '10000000-0000-0000-0000-000000000007')
     ORDER BY id $$,
  $$ VALUES ('10000000-0000-0000-0000-000000000001'::text),
            ('10000000-0000-0000-0000-000000000005'::text) $$,
  'tutors can find active and trial students, excluding discontinued students'
);
SELECT results_eq(
  $$ SELECT id::text FROM public.vtutor_session_staff_candidates
     WHERE id IN ('00000000-0000-0000-0000-000000000011',
                  '00000000-0000-0000-0000-000000000015') $$,
  $$ VALUES ('00000000-0000-0000-0000-000000000011'::text) $$,
  'tutors can find active staff, excluding inactive staff'
);

SELECT set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
SELECT is_empty('SELECT * FROM public.vtutor_session_student_candidates',
  'students cannot see tutor student candidates');
SELECT is_empty('SELECT * FROM public.vtutor_session_staff_candidates',
  'students cannot see tutor staff candidates');

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000015","role":"authenticated"}', true);
SELECT is_empty(
  'SELECT id FROM public.vtutor_session_student_candidates UNION ALL SELECT id FROM public.vtutor_session_staff_candidates',
  'inactive tutors cannot see participant candidates'
);

SELECT * FROM finish();
ROLLBACK;
