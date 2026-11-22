BEGIN;
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id='00000000-0000-0000-0000-000000000010' AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interview_categories(id,name) VALUES('e4911000-0000-4000-8000-000000000001','dev491live fixture');
INSERT INTO public.interview_stations(id,name,category_id,prompt,maximum_points)
SELECT ('e4912000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'dev491live station '||n,'e4911000-0000-4000-8000-000000000001',to_jsonb(repeat('Current bank prompt ',30)),6 FROM generate_series(1,6)n;
INSERT INTO public.interview_questions(id,station_id,position,tag_ids,question,rubric,rubric_version,suggested_time_seconds)
SELECT ('e4913000-0000-4000-8000-'||lpad((n*10+q)::text,12,'0'))::uuid,('e4912000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,q-1,'{}',to_jsonb(repeat('Current question ',30)),to_jsonb(repeat('Current rubric guidance ',100)),2,60 FROM generate_series(1,6)n CROSS JOIN generate_series(1,4)q;
INSERT INTO public.interviews(id,data) VALUES('e4910000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES('e4910000-0000-4000-8000-000000000001','e4910000-0000-4000-8000-000000000000','00000000-0000-0000-0000-000000000010',
ARRAY['00000000-0000-0000-0000-000000000010']::uuid[],ARRAY(SELECT ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6)n),
jsonb_build_object('name','dev491live six station fixture','delivery','online','mode','exam','recordingEnabled',true,'createdAt',now()-interval '2 hours','createdBy','00000000-0000-0000-0000-000000000010','interviewId','e4910000-0000-4000-8000-000000000000',
'createdAt',now(),'scheduledAt',NULL,'startedAt',now()-interval '1 hour','phase','questions','phaseStartedAt',now()-interval '1 minute','phaseDeadline',now()+interval '10 minutes','readingTimeSeconds',60,'questionTimeSeconds',600,'rotation',5,'pausedAt',NULL,'remainingMilliseconds',NULL,'phaseHistory','[]'::jsonb,'releasedResults','[]'::jsonb,
'studentIds',(SELECT jsonb_agg('10000000-0000-0000-0000-'||lpad(n::text,12,'0')) FROM generate_series(1,6)n),
'assignments',jsonb_build_array(jsonb_build_object('stationId','e4914000-0000-4000-8000-000000000001','tutorId','00000000-0000-0000-0000-000000000010')),
'students',(SELECT jsonb_agg(jsonb_build_object('id','10000000-0000-0000-0000-'||lpad(n::text,12,'0'),'name','Fixture student '||n)) FROM generate_series(1,6)n),
 'tutors',jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-000000000010','name','Fixture tutor')),
'stations',(SELECT jsonb_agg(jsonb_build_object('id','e4914000-0000-4000-8000-'||lpad(n::text,12,'0'),'stationId','e4912000-0000-4000-8000-'||lpad(n::text,12,'0'),'name','Station '||n,'prompt',repeat('Frozen prompt ',60),'maximumPoints',6,
'questions',(SELECT jsonb_agg(jsonb_build_object('id','e4915000-0000-4000-8000-'||lpad((n*10+q)::text,12,'0'),'questionId','e4913000-0000-4000-8000-'||lpad((n*10+q)::text,12,'0'),'question',repeat('Frozen wording ',60),'rubric','Frozen rubric','rubricVersion',1)) FROM generate_series(1,4)q)) ORDER BY n) FROM generate_series(1,6)n),
'progress',(SELECT jsonb_agg(jsonb_build_object('stationId','e4914000-0000-4000-8000-'||lpad(n::text,12,'0'),'tutorId','00000000-0000-0000-0000-000000000010','studentId','10000000-0000-0000-0000-'||lpad(n::text,12,'0'),'ready',true,'endedEarly',false,'feedbackComplete',false)) FROM generate_series(1,6)n),
'attempts',(SELECT jsonb_agg(jsonb_build_object('id','e4916000-0000-4000-8000-'||lpad((n*10+s)::text,12,'0'),'stationId','e4914000-0000-4000-8000-'||lpad(n::text,12,'0'),'studentId','10000000-0000-0000-0000-'||lpad(s::text,12,'0'),'completed',n<>s,'score',4,'selectedQuestionId','e4915000-0000-4000-8000-'||lpad((n*10+1)::text,12,'0'),'questionIntervals',CASE WHEN n=s THEN jsonb_build_array(jsonb_build_object('questionId','e4915000-0000-4000-8000-'||lpad((n*10+1)::text,12,'0'),'startedAt',now()-interval '1 minute','endedAt',NULL,'deadlineAt',now()+interval '10 minutes')) ELSE '[]'::jsonb END,
'generalFeedback',repeat('Station feedback ',25),'feedback',(SELECT jsonb_agg(jsonb_build_object('placementId','e4915000-0000-4000-8000-'||lpad((n*10+q)::text,12,'0'),'value',repeat('Written feedback ',25))) FROM generate_series(1,4)q))) FROM generate_series(1,6)n CROSS JOIN generate_series(1,6)s)));
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT data FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 (SELECT data-'stations' FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'Live snapshot keeps the authoritative round state without repeating station content');
SELECT is((SELECT actor_id FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 '00000000-0000-0000-0000-000000000010'::uuid,'Live state identifies the verified Tutor without loading the authoring catalogue');
CREATE TEMP TABLE live_content_before AS SELECT content_revision,stations FROM public.vtutor_interview_live_rounds
 WHERE id='e4910000-0000-4000-8000-000000000001';
SELECT ok((SELECT length(content_revision)=32 FROM live_content_before),'Station content has an opaque revision');
RESET ROLE;
UPDATE public.interview_questions SET rubric='"Corrected marking guidance"',rubric_version=rubric_version+1
WHERE id='e4913000-0000-4000-8000-000000000011';
SET LOCAL ROLE authenticated;
SELECT isnt((SELECT content_revision FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 (SELECT content_revision FROM live_content_before),'A rubric correction invalidates content without a round version change');
SELECT is((SELECT stations->0->'questions'->0->>'rubric' FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'Corrected marking guidance','Fresh station content contains the corrected rubric');
SELECT is((SELECT stations FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 (SELECT data->'stations' FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'Explicit station reads retain all question identities, frozen wording and current rubric guidance');
CREATE TEMP TABLE live_content_latest AS SELECT content_revision FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001';
RESET ROLE;
UPDATE public.interview_rounds SET version=version+1 WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT content_revision FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 (SELECT content_revision FROM live_content_latest),'Ordinary round updates do not resend unchanged station content');
-- Exercise timing normalization through the real Tutor facade, including the
-- states where a no-change guard must defer to the canonical transition logic.
RESET ROLE;
CREATE TEMP TABLE live_round_original AS SELECT data FROM public.interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001';
UPDATE public.interview_rounds SET data=data #- '{attempts,0,selectedQuestionId}' WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT data->'attempts'->0->>'selectedQuestionId' FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'e4915000-0000-4000-8000-000000000011','A missing active selection is restored to Question 1');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set(data,'{stations,0,questions}','[]') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT ok((SELECT data->'attempts'->0->'questionIntervals'->0->>'endedAt' IS NOT NULL FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'A removed selection with no default question still closes an open interval');
RESET ROLE;
UPDATE public.interview_rounds SET data=(SELECT data FROM live_round_original) || jsonb_build_object('pausedAt',now()) WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT (data->'attempts'->0->'questionIntervals'->0->>'endedAt')::timestamptz FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 now(),'Pausing closes answering time at the pause timestamp');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set((SELECT data FROM live_round_original),'{progress,0,endedEarly}','true') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT ok((SELECT data->'attempts'->0->'questionIntervals'->0->>'endedAt' IS NOT NULL FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'Ending a station still closes the active question interval');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set((SELECT data FROM live_round_original),'{attempts,0,selectedQuestionId}','42') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT jsonb_typeof(data->'attempts'->0->'selectedQuestionId') FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'string','Legacy non-string selected identities retain canonical normalization');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set((SELECT data FROM live_round_original),'{attempts,1,questionIntervals}','null') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT data FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'$$,
 '22023','cannot get array length of a scalar','Malformed historical intervals retain the previous error instead of being silently accepted');
RESET ROLE;
UPDATE public.interview_rounds SET data=(SELECT data FROM live_round_original) #- '{attempts,0,selectedQuestionId}' #- '{attempts,0,questionIntervals}' WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT jsonb_array_length(data->'attempts'->0->'questionIntervals') FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 1,'Missing active interval state still opens the first answering interval');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set((SELECT data FROM live_round_original),'{attempts,0,selectedQuestionId}','null') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT data->'attempts'->0->>'selectedQuestionId' FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'e4915000-0000-4000-8000-000000000011','A JSON-null active selection still receives the default question');
RESET ROLE;
UPDATE public.interview_rounds SET data=jsonb_set((SELECT data FROM live_round_original),'{phase}','"completed"') WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT ok((SELECT data->'attempts'->0->'questionIntervals'->0->>'endedAt' IS NOT NULL FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 'Completion still closes an interval left open in stored state');
RESET ROLE;
UPDATE public.interview_rounds SET data=(SELECT data FROM live_round_original) #- '{attempts}' WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT data->'attempts' FROM public.vtutor_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),
 '[]'::jsonb,'A missing attempts array is still added by canonical timing');
RESET ROLE;
UPDATE public.interview_rounds SET data=(SELECT data FROM live_round_original) WHERE id='e4910000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'),0::bigint,
 'An unrelated Tutor cannot read live state or content revisions');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_live_rounds),0::bigint,'Students cannot use the Tutor live projection');
SELECT is(public.interview_round_live_json(jsonb_populate_record(NULL::public.interview_rounds,
 '{"id":"e4910000-0000-4000-8000-000000000001","created_by":"10000000-0000-0000-0000-000000000001"}'::jsonb)),NULL::jsonb,
 'Forging a composite argument does not grant Tutor round access');
RESET ROLE;
SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_live_rounds','SELECT'),'Anonymous callers cannot read live snapshots');
SELECT ok(NOT has_table_privilege('authenticated','public.vtutor_interview_live_rounds','UPDATE'),'Live views grant no assessment writes');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Full station reconstruction forbidden on the frequent live-state read'; END;
$$;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT data FROM public.vtutor_interview_live_rounds WHERE id='e4910000-0000-4000-8000-000000000001'$$,
 'Frequent live state does not reconstruct full station/rubric content');
RESET ROLE;
CREATE OR REPLACE FUNCTION public.interview_effective_state(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'All-attempt timing projection forbidden for Student live reads'; END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$SELECT data FROM public.vstudent_interview_rounds WHERE id='e4910000-0000-4000-8000-000000000001'$$,
 'Student live reads use their visible phase state without calculating every Tutor answering interval');
SELECT * FROM finish();
ROLLBACK;
