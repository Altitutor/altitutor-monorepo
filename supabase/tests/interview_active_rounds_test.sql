BEGIN;
SELECT no_plan();

-- Fixture writes are local to this transaction. Reads use the actual public
-- facades under the caller role, including malformed/incomplete legacy names.
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')
  AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interviews(id,data) VALUES('e4820000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4820000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'e4820000-0000-4000-8000-000000000000',
 '00000000-0000-0000-0000-000000000010',
 ARRAY[CASE WHEN n IN (7,8) THEN '00000000-0000-0000-0000-000000000011' ELSE '00000000-0000-0000-0000-000000000010' END]::uuid[],
 ARRAY[CASE WHEN n IN (7,8,9) THEN '10000000-0000-0000-0000-000000000002' ELSE '10000000-0000-0000-0000-000000000001' END]::uuid[],
 jsonb_build_object('name',CASE WHEN n=10 THEN 'null'::jsonb ELSE to_jsonb('Round '||n) END,
   'startedAt',CASE WHEN n IN (4,12) THEN NULL ELSE now()-interval '1 hour' END,
   'phase',CASE WHEN n=5 THEN 'completed' WHEN n=2 THEN 'reading' WHEN n=11 THEN NULL ELSE 'waiting' END,
   'phaseDeadline',now()-interval '1 minute','questionTimeSeconds',30,
   'pausedAt',CASE WHEN n=3 THEN now() ELSE NULL END,
   'assignments',jsonb_build_array(jsonb_build_object('tutorId',CASE WHEN n IN (7,8,9)
     THEN '00000000-0000-0000-0000-000000000011' ELSE '00000000-0000-0000-0000-000000000010' END)),
   'deletedAt',CASE WHEN n=6 THEN now() ELSE NULL END)
FROM generate_series(1,12) n;

SELECT has_view('public','vtutor_interview_active_rounds','Tutor has a minimal active-round facade');
SELECT has_view('public','vstudent_interview_active_rounds','Student has a minimal active-round facade');
SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_active_rounds','SELECT'),'Anon cannot read tutor active rounds');
SELECT ok(NOT has_table_privilege('anon','public.vstudent_interview_active_rounds','SELECT'),'Anon cannot read student active rounds');
SELECT ok(NOT has_table_privilege('authenticated','public.vtutor_interview_active_rounds','UPDATE'),'Tutor summary grants no round writes');
SELECT ok(NOT has_table_privilege('authenticated','public.vstudent_interview_active_rounds','UPDATE'),'Student summary grants no round writes');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT results_eq($$SELECT id FROM public.vtutor_interview_active_rounds WHERE id::text LIKE 'e4820000-%' ORDER BY id$$,
 $$SELECT ('e4820000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[1,2,3,10]) n$$,
 'Assigned tutor sees started waiting, elapsed reading and paused rounds, excluding completed/deleted/unstarted/creator-only/mismatched assignments');
SELECT is((SELECT name FROM public.vtutor_interview_active_rounds WHERE id='e4820000-0000-4000-8000-000000000010'),'Mock interview','Legacy null name retains banner fallback');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT results_eq($$SELECT id FROM public.vtutor_interview_active_rounds WHERE id::text LIKE 'e4820000-%' ORDER BY id$$,
 $$SELECT ('e4820000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[7,8]) n$$,
 'Another participating tutor sees only rounds authorized by both roster and assignment');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT results_eq($$SELECT id FROM public.vstudent_interview_active_rounds WHERE id::text LIKE 'e4820000-%' ORDER BY id$$,
 $$SELECT ('e4820000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[1,2,3,10]) n$$,
 'Enrolled student sees only their started noncompleted nondeleted rounds');
SELECT is((SELECT count(*) FROM public.vtutor_interview_active_rounds),0::bigint,'Student has no tutor summary visibility');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT results_eq($$SELECT id FROM public.vstudent_interview_active_rounds WHERE id::text LIKE 'e4820000-%' ORDER BY id$$,
 $$SELECT ('e4820000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[7,8,9]) n$$,
 'Another student does not see the first student rounds');
RESET ROLE;

-- Rendering unrelated rich fields must never be required merely to discover
-- an active round. These transactional stubs are rolled back with the test.
CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Rich tutor projection must not run during discovery'; END;
$$;
CREATE OR REPLACE FUNCTION public.interview_student_round_json(r public.interview_rounds,p_student_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Rich student projection must not run during discovery'; END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(name) FROM public.vtutor_interview_active_rounds WHERE id::text LIKE 'e4820000-%'),4::bigint,
 'Tutor discovery does not invoke full round rendering');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(name) FROM public.vstudent_interview_active_rounds WHERE id::text LIKE 'e4820000-%'),4::bigint,
 'Student discovery does not invoke full round rendering');
RESET ROLE;
UPDATE public.classes_students SET unenrolled_at=now()-interval '1 second'
WHERE student_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_active_rounds),0::bigint,'Ended interview enrolment removes active-round discovery');
SELECT * FROM finish();
ROLLBACK;
