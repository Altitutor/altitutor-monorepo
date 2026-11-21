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
INSERT INTO public.interviews(id,data) VALUES('e4870000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4870000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'e4870000-0000-4000-8000-000000000000',
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


UPDATE public.interview_rounds SET data=data || jsonb_build_object(
 'createdAt',now(),'interviewId',interview_id,'phaseStartedAt',now()-interval '2 minutes',
 'readingTimeSeconds',60,'questionTimeSeconds',90,'rotationAllowanceSeconds',120,
 'studentIds',to_jsonb(student_ids),'students',jsonb_build_array(jsonb_build_object('id',student_ids[1],'name','Student fixture')),
 'tutors',jsonb_build_array(jsonb_build_object('id',tutor_ids[1],'name','Tutor fixture')),
 'delivery','online','mode','exam','recordingEnabled',true,
 'scheduledAt',now()+interval '1 day',
 'progress','[]'::jsonb,'attempts','[]'::jsonb,
 'releasedResults',jsonb_build_array(jsonb_build_object('studentId','10000000-0000-0000-0000-000000000001','privateFeedback','never-list-this')),
 'stations',(SELECT jsonb_agg(jsonb_build_object('id',n::text,'name','Station','prompt',repeat('Prompt body ',100),'questions','[]'::jsonb)) FROM generate_series(1,13) n))
WHERE id::text LIKE 'e4870000-%';

UPDATE public.interview_rounds SET data=jsonb_set(data,'{stations}',jsonb_build_array(data->'stations'->0))
WHERE id='e4870000-0000-4000-8000-000000000012';

SELECT has_view('public','vtutor_interview_round_summaries','Tutor list has a compact scoped facade');
SELECT has_view('public','vstudent_interview_round_summaries','Student list has a compact scoped facade');
SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_round_summaries','SELECT'),'Anon cannot list tutor summaries');
SELECT ok(NOT has_table_privilege('anon','public.vstudent_interview_round_summaries','SELECT'),'Anon cannot list student summaries');
SELECT ok(NOT has_table_privilege('authenticated','public.vtutor_interview_round_summaries','UPDATE'),'Tutor summary grants no writes');
SELECT ok(NOT has_table_privilege('authenticated','public.vstudent_interview_round_summaries','UPDATE'),'Student summary grants no writes');

-- The compact clock must preserve both automatic transitions, null/future
-- deadlines and paused states while never touching timing/history bodies.
SELECT is(public.interview_effective_phase_state(d),jsonb_build_object('phase',effective->'phase','phaseStartedAt',effective->'phaseStartedAt','phaseDeadline',effective->'phaseDeadline'),label)
FROM (VALUES
 ('elapsed reading',jsonb_build_object('phase','reading','phaseDeadline',now()-interval '15 seconds')),
 ('elapsed reading and questions',jsonb_build_object('phase','reading','phaseDeadline',now()-interval '3 minutes')),
 ('elapsed questions',jsonb_build_object('phase','questions','phaseDeadline',now()-interval '1 second')),
 ('future questions',jsonb_build_object('phase','questions','phaseDeadline',now()+interval '1 minute')),
 ('paused reading',jsonb_build_object('phase','reading','phaseDeadline',now()-interval '3 minutes','pausedAt',now()-interval '1 minute')),
 ('waiting without deadline',jsonb_build_object('phase','waiting','phaseDeadline',NULL))
) sample(label,clock)
CROSS JOIN LATERAL (SELECT clock || jsonb_build_object('phaseStartedAt',now()-interval '5 minutes','questionTimeSeconds',90,'attempts','[]'::jsonb,'progress','[]'::jsonb,'stations','[]'::jsonb) AS d) prepared
CROSS JOIN LATERAL (SELECT public.interview_effective_state(d) AS effective) rich;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_round_summaries WHERE id::text LIKE 'e4870000-%'),11::bigint,'Creator can list own rounds including unstarted/completed but not deleted');
SELECT is((SELECT (data->>'stationCount')::integer FROM public.vtutor_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),13,'List preserves station count without station bodies');
SELECT is((SELECT data->'students'->0->>'name' FROM public.vtutor_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),'Student fixture','Tutor roster names retained');
SELECT is((SELECT data->>'releasedResultCount' FROM public.vtutor_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),'1','Tutor release availability retained without release bodies');
SELECT ok((SELECT NOT(data ?| ARRAY['stations','attempts','progress','releasedResults','recordings','connectedStudentIds']) FROM public.vtutor_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),'Tutor summary excludes rich bodies and presence');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_round_summaries WHERE id::text LIKE 'e4870000-%'),2::bigint,'Other tutor can list only roster-scoped rounds');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_summaries WHERE id::text LIKE 'e4870000-%'),8::bigint,'Student list preserves own upcoming/completed rounds and excludes other students/deleted rounds');
SELECT ok((SELECT (data->>'hasReleasedResults')::boolean FROM public.vstudent_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),'Student sees own release availability');
SELECT is((SELECT (data->>'scheduledEndAt')::timestamptz-(data->>'scheduledAt')::timestamptz FROM public.vstudent_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),interval '58 minutes 30 seconds','Scheduled duration preserves reading+questions+allowance for all 13 stations');
SELECT is((SELECT (data->>'scheduledEndAt')::timestamptz-(data->>'scheduledAt')::timestamptz FROM public.vstudent_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000012'),interval '4 minutes 30 seconds','Short scheduled rounds retain their real estimate without an added minimum');
SELECT ok((SELECT NOT(data ?| ARRAY['stations','result','resultStations','prompt','attempts','recordings']) FROM public.vstudent_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000001'),'Student summary excludes feedback, prompts and media');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT ok((SELECT NOT(data->>'hasReleasedResults')::boolean FROM public.vstudent_interview_round_summaries WHERE id='e4870000-0000-4000-8000-000000000007'),'Another student release availability is not copied');
RESET ROLE;

-- Transactional failure sentinels prove actual list reads never enter the
-- expensive rich projection, timing or phase-history paths.
CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Rich tutor projection forbidden in list'; END; $$;
CREATE OR REPLACE FUNCTION public.interview_student_round_json(r public.interview_rounds,p_student_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Rich student projection forbidden in list'; END; $$;
CREATE OR REPLACE FUNCTION public.interview_effective_state(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Full timing projection forbidden in list'; END; $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT lives_ok($$SELECT data FROM public.vtutor_interview_round_summaries WHERE id::text LIKE 'e4870000-%'$$,'Actual tutor list bypasses rich projection and timing');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$SELECT data FROM public.vstudent_interview_round_summaries WHERE id::text LIKE 'e4870000-%'$$,'Actual student list bypasses rich projection and timing');
RESET ROLE;
UPDATE public.classes_students SET unenrolled_at=now()-interval '1 second' WHERE student_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_summaries),0::bigint,'Ended enrolment removes list visibility');
SELECT * FROM finish();
ROLLBACK;
