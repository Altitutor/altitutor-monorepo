BEGIN;
SELECT plan(11);

-- Give Alice separate interview and UCAT class enrolments. The assigned
-- lesson lets us distinguish a privilege failure from an empty fixture.
UPDATE public.classes SET subject_id = (SELECT id FROM public.subjects WHERE name = 'Medicine Interview')
WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE public.classes SET subject_id = public.get_ucat_subject_id()
WHERE id = '20000000-0000-0000-0000-000000000004';

CREATE TEMP TABLE assigned_lesson AS
SELECT id FROM public.ucat_learning_modules WHERE kind = 'lesson' AND deleted_at IS NULL
ORDER BY id LIMIT 1;
INSERT INTO public.ucat_sessions_resources (session_id, ucat_learning_module_id, index)
SELECT '50000000-0000-0000-0000-000000000004', id, 0 FROM assigned_lesson;
GRANT SELECT ON assigned_lesson TO authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is(public.interview_student_has_access('10000000-0000-0000-0000-000000000001'), false,
  'another student cannot query Alice''s interview eligibility');
SELECT throws_ok(
  $$SELECT public.student_has_in_person_ucat_session_resource('10000000-0000-0000-0000-000000000001', 'learning_module', (SELECT id FROM assigned_lesson))$$,
  '42501', NULL, 'students cannot call the server-only UCAT entitlement predicate');
SELECT throws_ok(
  $$SELECT public.student_in_person_ucat_session_resource_ids('10000000-0000-0000-0000-000000000001', 'learning_module', ARRAY(SELECT id FROM assigned_lesson))$$,
  '42501', NULL, 'students cannot call the server-only bulk entitlement predicate');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"service_role"}', true);
SELECT is(public.interview_student_has_access('10000000-0000-0000-0000-000000000001'), false,
  'an authenticated database role cannot elevate via a claim setting alone');
SELECT set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT is(public.interview_student_has_access('10000000-0000-0000-0000-000000000001'), false,
  'an authenticated account without a student or staff link cannot query eligibility');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is((SELECT has_access FROM public.vstudent_interview_access), true, 'Alice retains access through her student view');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT ok(EXISTS (
  SELECT 1 FROM public.vtutor_interview_catalog
  CROSS JOIN LATERAL jsonb_array_elements(data->'students') AS student
  WHERE student->>'id' = '10000000-0000-0000-0000-000000000001'
), 'an authorized interview tutor still sees Alice in the interview catalog');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
SELECT is(public.interview_student_has_access('10000000-0000-0000-0000-000000000001'), false,
  'a tutor outside the interview capability cannot query eligibility');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT is(public.interview_student_has_access('10000000-0000-0000-0000-000000000001'), true,
  'the service role can validate interview eligibility for round setup');
SELECT is(public.student_has_in_person_ucat_session_resource(
  '10000000-0000-0000-0000-000000000001', 'learning_module', (SELECT id FROM assigned_lesson)
), true, 'the service role can check an assigned UCAT lesson');
SELECT results_eq(
  $$SELECT resource_id FROM public.student_in_person_ucat_session_resource_ids(
    '10000000-0000-0000-0000-000000000001', 'learning_module', ARRAY(SELECT id FROM assigned_lesson)
  )$$,
  $$SELECT id FROM assigned_lesson$$,
  'the service role can retrieve assigned UCAT lesson IDs in bulk'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
