BEGIN;
SELECT plan(16);
SELECT has_column('public', 'ucat_learning_modules', 'study_plan_journey_placement', 'authors can persist independent lesson journey placement');
INSERT INTO public.staff_subjects(staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE journey_lesson AS SELECT public.tutor_ucat_upsert_learning_module(
  p_module_id => NULL, p_kind => 'lesson', p_title => 'Synthetic general instruction',
  p_journey_placement => 'orientation', p_set_journey_placement => true
) AS id;
GRANT SELECT ON journey_lesson TO service_role;
SELECT is((SELECT study_plan_journey_placement FROM public.vtutor_ucat_learning_modules WHERE id = (SELECT id FROM journey_lesson)), 'orientation', 'tutors read their authored general placement');
SELECT throws_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => NULL, p_kind => 'lesson', p_title => 'Invalid section lesson', p_journey_placement => 'section_learning', p_set_journey_placement => true)$$, 'P0001', 'invalid_learning_module_journey_placement', 'section learning requires a section');
SELECT throws_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => NULL, p_kind => 'lesson', p_title => 'Invalid general lesson', p_ucat_section_id => (SELECT id FROM public.ucat_sections WHERE section_number = 1), p_journey_placement => 'orientation', p_set_journey_placement => true)$$, 'P0001', 'invalid_learning_module_journey_placement', 'general placement requires no section');
SELECT throws_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => NULL, p_kind => 'folder', p_title => 'Invalid folder', p_journey_placement => 'orientation', p_set_journey_placement => true)$$, 'P0001', 'invalid_learning_module_journey_placement', 'folders do not carry lesson placement');
SELECT throws_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => NULL, p_kind => 'lesson', p_title => 'Invalid vocabulary', p_journey_placement => 'arbitrary', p_set_journey_placement => true)$$, 'P0001', 'invalid_learning_module_journey_placement', 'unknown placements are rejected');
SELECT lives_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => (SELECT id FROM journey_lesson), p_kind => 'lesson', p_title => 'Ordinary edit')$$, 'older callers may edit without changing placement');
SELECT is((SELECT study_plan_journey_placement FROM public.vtutor_ucat_learning_modules WHERE id = (SELECT id FROM journey_lesson)), 'orientation', 'omitted metadata preserves authored placement');
SELECT lives_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => (SELECT id FROM journey_lesson), p_kind => 'lesson', p_title => 'Unclassified edit', p_journey_placement => NULL, p_set_journey_placement => true)$$, 'authors can explicitly return a general lesson to unclassified');
SELECT is((SELECT study_plan_journey_placement FROM public.vtutor_ucat_learning_modules WHERE id = (SELECT id FROM journey_lesson)), NULL::TEXT, 'explicit NULL is distinct from omitted metadata');
SELECT lives_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => (SELECT id FROM journey_lesson), p_kind => 'lesson', p_title => 'Section move', p_ucat_section_id => (SELECT id FROM public.ucat_sections WHERE section_number = 1), p_journey_placement => 'section_learning', p_set_journey_placement => true)$$, 'section and placement change atomically');
SELECT is((SELECT study_plan_journey_placement FROM public.vtutor_ucat_learning_modules WHERE id = (SELECT id FROM journey_lesson)), 'section_learning', 'a moved section lesson has matching placement');
SELECT lives_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => (SELECT id FROM journey_lesson), p_kind => 'lesson', p_title => 'Pre-Exam fixture', p_journey_placement => 'pre_exam', p_set_journey_placement => true)$$, 'a lesson can become intentionally general again');
RESET ROLE;
UPDATE public.ucat_learning_modules SET status = 'published', access_scope = 'public' WHERE id = (SELECT id FROM journey_lesson);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT study_plan_journey_placement FROM public.vstudent_ucat_learning_modules WHERE id = (SELECT id FROM journey_lesson)), 'pre_exam', 'the authenticated student view carries accessible placement');
SELECT throws_ok($$SELECT public.tutor_ucat_upsert_learning_module(p_module_id => NULL, p_kind => 'lesson', p_title => 'Forbidden student authoring')$$, 'P0001', 'forbidden', 'students cannot author placement through the tutor RPC');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT ok((public.get_student_ucat_study_plan_generation_bundle('10000000-0000-0000-0000-000000000002')->'vstudent_ucat_learning_modules') @> jsonb_build_array(jsonb_build_object('id', (SELECT id FROM journey_lesson), 'study_plan_journey_placement', 'pre_exam')), 'background generation receives the same authored placement');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
