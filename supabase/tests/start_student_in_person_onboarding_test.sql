BEGIN;
SELECT plan(14);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
UPDATE public.students SET user_id=NULL WHERE user_id='10000000-0000-0000-0000-000000000002';
INSERT INTO public.students(id,first_name,last_name,status,user_id) VALUES
 ('fd341000-0000-4000-8000-000000000001','UCAT','Only',NULL,'10000000-0000-0000-0000-000000000002'),
 ('fd341000-0000-4000-8000-000000000002','Active','Student','ACTIVE',NULL),
 ('fd341000-0000-4000-8000-000000000003','Ended','Student','DISCONTINUED',NULL),
 ('fd341000-0000-4000-8000-000000000004','Deleted','Student',NULL,NULL);
SELECT public.retire_student('fd341000-0000-4000-8000-000000000004');
INSERT INTO public.student_online_product_relationships(student_id,product) VALUES ('fd341000-0000-4000-8000-000000000001','UCAT_WEB');
SET LOCAL ROLE authenticated;
SELECT ok((public.search_students_admin(p_search => 'UCAT Only', p_statuses => NULL)->'students') @> '[{"id":"fd341000-0000-4000-8000-000000000001"}]'::jsonb,'enquiry search can find online-only Students');
SELECT ok(NOT has_function_privilege('anon','public.start_student_in_person_onboarding(uuid)','EXECUTE'),'anonymous callers cannot start onboarding');
SELECT lives_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000001')$$,'admin starts in-person onboarding for existing UCAT Student');
SELECT is((SELECT status FROM public.students WHERE id='fd341000-0000-4000-8000-000000000001'),'TRIAL','registration remains required for activation');
SELECT is((SELECT user_id FROM public.students WHERE id='fd341000-0000-4000-8000-000000000001'),'10000000-0000-0000-0000-000000000002'::uuid,'existing login retained');
SELECT is((SELECT count(*) FROM public.student_online_product_relationships WHERE student_id='fd341000-0000-4000-8000-000000000001' AND closed_at IS NULL),1::bigint,'UCAT relationship stays open');
SELECT is((SELECT count(*) FROM public.onboarding_journeys WHERE student_id='fd341000-0000-4000-8000-000000000001' AND closed_at IS NULL),1::bigint,'student appears in onboarding queue');
SELECT lives_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000001')$$,'retry is safe');
SELECT is((SELECT count(*) FROM public.onboarding_journeys WHERE student_id='fd341000-0000-4000-8000-000000000001' AND closed_at IS NULL),1::bigint,'retry reuses journey');
SELECT throws_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000002')$$,'P0001','In-person onboarding is only available before registration','active Student cannot restart registration');
SELECT throws_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000003')$$,'P0001','In-person onboarding is only available before registration','discontinued Student must use re-enrolment');
SELECT throws_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000004')$$,'P0002','Student not found','deleted Student cannot start onboarding');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000001')$$,'42501','Active AdminStaff access required','student cannot invoke admin operation');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.start_student_in_person_onboarding('fd341000-0000-4000-8000-000000000001')$$,'42501','Active AdminStaff access required','tutor cannot invoke admin operation');
SELECT * FROM finish();
ROLLBACK;
