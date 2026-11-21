BEGIN;
SELECT no_plan();
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')
AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interviews(id,data) VALUES('e4871000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4871000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'e4871000-0000-4000-8000-000000000000','00000000-0000-0000-0000-000000000010',
ARRAY['00000000-0000-0000-0000-000000000010']::uuid[],ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],
jsonb_build_object('delivery','online','mode','exam','recordingEnabled',true,
 'startedAt',CASE WHEN n=1 THEN NULL ELSE now()-interval '1 hour' END,
 'phase',CASE WHEN n IN (1,2) THEN 'waiting' WHEN n IN (3,4,5,7) THEN 'reading' WHEN n=8 THEN 'completed' ELSE 'questions' END,
 'pausedAt',CASE WHEN n=7 THEN now()-interval '1 second' ELSE NULL END,
 'phaseStartedAt',now()-interval '2 minutes',
 'phaseDeadline',CASE WHEN n IN (4,7) THEN now()-interval '10 seconds' WHEN n IN (5,6) THEN now()-interval '2 minutes' ELSE now()+interval '1 minute' END,
 'questionTimeSeconds',60,'phaseHistory','[]'::jsonb,
 'progress',jsonb_build_array(jsonb_build_object('stationId','station','tutorId','00000000-0000-0000-0000-000000000010','studentId','10000000-0000-0000-0000-000000000001','endedEarly',false,'feedbackComplete',false)),
 'attempts',jsonb_build_array(jsonb_build_object('id','e4871000-0000-4000-8000-000000000020','stationId','station','studentId','10000000-0000-0000-0000-000000000001','feedback',jsonb_build_array(jsonb_build_object('value',repeat('private feedback',1000))))),
 'stations',jsonb_build_array(jsonb_build_object('id','station','questions',jsonb_build_array(jsonb_build_object('id','question','rubric',repeat('private rubric',1000))))),
 'students',jsonb_build_array(jsonb_build_object('id','10000000-0000-0000-0000-000000000001','name','Student')),
 'tutors',jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-000000000010','name','Tutor')),
 'deletedAt',CASE WHEN n=9 THEN now() ELSE NULL END)
FROM generate_series(1,9) n;

SELECT ok(NOT has_function_privilege('authenticated','public.interview_media_policy_state(uuid)','EXECUTE'),'Browser cannot call service policy RPC');
SELECT ok(NOT has_function_privilege('anon','public.interview_media_policy_state(uuid)','EXECUTE'),'Anon cannot call service policy RPC');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT results_eq($q$
 SELECT state->>'phase',state->>'phaseStartedAt',state->>'phaseDeadline',state->>'pausedAt'
 FROM public.interview_rounds r CROSS JOIN LATERAL public.interview_media_policy_state(r.id) state
 WHERE r.id::text LIKE 'e4871000-%' AND r.data->>'deletedAt' IS NULL ORDER BY r.id
$q$,$q$
 SELECT state->>'phase',state->>'phaseStartedAt',state->>'phaseDeadline',state->>'pausedAt'
 FROM public.interview_rounds r CROSS JOIN LATERAL public.interview_effective_state(r.data) state
 WHERE r.id::text LIKE 'e4871000-%' AND r.data->>'deletedAt' IS NULL ORDER BY r.id
$q$,'Media phase clock matches authoritative timing before/after deadlines, both crossed deadlines, pause, waiting and completion');
SELECT is(public.interview_media_policy_state('e4871000-0000-4000-8000-000000000009'),NULL::jsonb,'Deleted round has no media policy');
SELECT is(public.interview_media_policy_state('e4871000-0000-4000-8000-000000000099'),NULL::jsonb,'Missing round has no media policy');
SELECT ok(NOT (public.interview_media_policy_state('e4871000-0000-4000-8000-000000000001') ?| ARRAY['stations','releasedResults','connectedStudentIds']), 'Media state contains no assessment/presence payload');
SELECT ok(NOT (public.interview_media_policy_state('e4871000-0000-4000-8000-000000000001')->'attempts'->0 ? 'feedback'),'Media attempt identity contains no private feedback');

-- A media policy must not need a rich renderer, even while that renderer fails.
CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Rich tutor projection must not run for media'; END;
$$;
SELECT lives_ok($$SELECT public.interview_media_policy_state('e4871000-0000-4000-8000-000000000003')$$,'Media policy is independent of rich round rendering');
SELECT has_view('public','vtutor_interview_media_access','Tutor media authorization has a minimal scoped facade');
SELECT has_view('public','vstudent_interview_media_access','Student media authorization has a minimal scoped facade');
SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_media_access','SELECT'),'Anon cannot read tutor media admission');
SELECT ok(NOT has_table_privilege('anon','public.vstudent_interview_media_access','SELECT'),'Anon cannot read student media admission');
SELECT ok(NOT has_table_privilege('authenticated','public.vtutor_interview_media_access','UPDATE'),'Tutor admission facade grants no writes');
SELECT ok(NOT has_table_privilege('authenticated','public.vstudent_interview_media_access','UPDATE'),'Student admission facade grants no writes');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_media_access WHERE id::text LIKE 'e4871000-%'),8::bigint,'Assigned tutor media admission includes waiting and completed rounds but excludes deletion');
SELECT is((SELECT actor_id FROM public.vtutor_interview_media_access WHERE id='e4871000-0000-4000-8000-000000000001'),'00000000-0000-0000-0000-000000000010'::uuid,'Tutor admission returns only the caller tutor identity');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_media_access WHERE id::text LIKE 'e4871000-%'),0::bigint,'Unassigned noncreator tutor cannot obtain admission');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_media_access WHERE id::text LIKE 'e4871000-%'),8::bigint,'Enrolled roster student can request policy for their round');
SELECT is((SELECT actor_id FROM public.vstudent_interview_media_access WHERE id='e4871000-0000-4000-8000-000000000001'),'10000000-0000-0000-0000-000000000001'::uuid,'Student admission returns only the caller student identity');
SELECT is((SELECT count(*) FROM public.vtutor_interview_media_access),0::bigint,'Student cannot obtain tutor admission');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_media_access WHERE id::text LIKE 'e4871000-%'),0::bigint,'Another enrolled student cannot obtain admission');
RESET ROLE;
UPDATE public.classes_students SET unenrolled_at=now()-interval '1 second'
WHERE student_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_media_access),0::bigint,'Ended enrolment removes media admission');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
