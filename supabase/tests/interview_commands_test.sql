BEGIN;
SELECT no_plan();
-- Fixture enrollment and tutor capabilities; behavior is observed only through
-- the public command/read facade, never by asserting internal round JSON.
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011') AND sub.name='Medicine Interview'
ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE FUNCTION pg_temp.cmd(p jsonb,actor uuid DEFAULT '00000000-0000-0000-0000-000000000010') RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_command(actor,jsonb_build_object('commandId',gen_random_uuid())||p);
$$;
CREATE FUNCTION pg_temp.round_cmd(kind text,extra jsonb DEFAULT '{}',actor uuid DEFAULT '00000000-0000-0000-0000-000000000010') RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type',kind,'roundId','e8000000-0000-4000-8000-000000000020','expectedVersion',
 (SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'))||extra,actor);
$$;
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveCategory","category":{"id":"e8000000-0000-4000-8000-000000000001","name":"Personal","parentId":null}}')$q$,'Medicine tutor can create a configurable category');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e8000000-0000-4000-8000-000000000100","name":"Motivation","categoryId":"e8000000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6.5,"archived":false,"questions":[{"id":"e8000000-0000-4000-8000-000000000002","stationId":"e8000000-0000-4000-8000-000000000100","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e8000000-0000-4000-8000-000000000101","name":"Follow up","categoryId":"e8000000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6,"archived":false,"questions":[{"id":"e8000000-0000-4000-8000-000000000003","stationId":"e8000000-0000-4000-8000-000000000101","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT is((SELECT data->'stations'->0->'questions'->0->>'question' FROM public.vtutor_interview_catalog),'Why medicine?','Saved station question is readable from tutor facade');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveRubric","stationId":"e8000000-0000-4000-8000-000000000100","expectedVersion":0,"questionId":"e8000000-0000-4000-8000-000000000002","rubric":"stale"}')$q$,'PT409','Question changed; reload before saving','Stale bank edit is rejected');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e8000000-0000-4000-8000-000000000010","name":"Mock MMI","readingTimeSeconds":60,"questionTimeSeconds":60,"recordingEnabled":true,"archived":false,"stations":[{"id":"e8000000-0000-4000-8000-000000000011","stationId":"e8000000-0000-4000-8000-000000000100"},{"id":"e8000000-0000-4000-8000-000000000013","stationId":"e8000000-0000-4000-8000-000000000101"}]}}')$q$,'Interview references complete stations with decimal maxima');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"createRound","roundId":"e8000000-0000-4000-8000-000000000020","setup":{"interviewId":"e8000000-0000-4000-8000-000000000010","name":"Practice","delivery":"online","mode":"exam","recordingEnabled":true,"scheduledAt":null,"studentIds":["10000000-0000-0000-0000-000000000001"],"assignments":[{"stationId":"e8000000-0000-4000-8000-000000000011","tutorId":"00000000-0000-0000-0000-000000000010"},{"stationId":"e8000000-0000-4000-8000-000000000013","tutorId":"00000000-0000-0000-0000-000000000011"}]}}')$q$,'A round supports fewer students than stations');
SELECT is((SELECT jsonb_array_length(data->'attempts') FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),2,'One attempt is prepared for each student/station occurrence');
SELECT is((SELECT data->'progress'->1->>'studentId' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),NULL,'Unoccupied station is idle');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('start')$q$,'Tutor explicitly opens waiting room');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('startReading')$q$,'22023','Every tutor must be ready','Reading requires tutor readiness');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('ready','{"ready":true}')$q$,'First tutor becomes ready');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011')$q$,'Second tutor becomes ready');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('startReading')$q$,'22023','Students are disconnected; explicit override required','Missing student connection requires deliberate override');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('startReading','{"overrideMissingStudents":true}')$q$,'Any assigned tutor can override missing connection');
SELECT is((SELECT data->>'phase' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'reading','Round starts reading');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('pause')$q$,'Any assigned tutor can pause');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('resume')$q$,'Any assigned tutor can resume');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('updateRound','{"setup":{}}')$q$,'22023','Assignments are fixed after start','Assignments cannot be changed after start');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT data->>'prompt' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Read this scenario','Student sees own current reading prompt');
SELECT is((SELECT data->'result' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'null'::jsonb,'Unreleased assessments stay hidden');
SELECT is((SELECT count(*) FROM public.vtutor_interview_catalog),0::bigint,'Student cannot read tutor station bank');
SELECT is((SELECT count(*) FROM public.interview_rounds),0::bigint,'Student cannot read base rounds');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_command(uuid,jsonb)','EXECUTE'),'Browser cannot invoke service-only command RPC');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),0::bigint,'Another student cannot read the round');
RESET ROLE;
-- Restore tutor actor. Manipulating only the fixture's deadline represents a
-- request arriving after both server deadlines; reads/assertions use the facade.
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE FUNCTION pg_temp.mark(station_index integer,points numeric,reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE d jsonb; a jsonb; st jsonb; tutor uuid;
BEGIN
 SELECT data INTO d FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020';
 st:=d->'stations'->station_index;
 SELECT value INTO a FROM jsonb_array_elements(d->'attempts') WHERE value->>'stationId'=st->>'id';
 SELECT (value->>'tutorId')::uuid INTO tutor FROM jsonb_array_elements(d->'progress') WHERE value->>'stationId'=st->>'id';
 RETURN pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId',d->'id','attemptId',a->'id','expectedAttemptVersion',a->'version','score',points,'notAssessedReason',reason,
 'feedback',jsonb_build_array(jsonb_build_object('placementId',st->'questions'->0->'id','value','Useful feedback'))),tutor);
END;
$fn$;
CREATE FUNCTION pg_temp.general_note(note jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId',r.id,'attemptId',a->'id','expectedAttemptVersion',a->'version',
 'score',a->'score','notAssessedReason',a->'notAssessedReason','feedback',a->'feedback','generalFeedback',note))
 FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000020' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011';
$$;
SELECT lives_ok($q$SELECT pg_temp.general_note('"Overall empathy"')$q$,'General feedback can save without a score or question feedback');
SELECT is((SELECT data->'attempts'->0->>'generalFeedback' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Overall empathy','Assigned tutor reads saved general feedback');
SELECT is((SELECT jsonb_array_length(data->'attempts'->0->'feedback') FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),0,'General feedback does not answer an individual question');
SELECT lives_ok($q$SELECT pg_temp.mark(0,6.25)$q$,'Assigned tutor can save fractional score and question feedback');
SELECT is((SELECT data->'attempts'->0->>'generalFeedback' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Overall empathy','Legacy question-only save preserves general feedback');
SELECT throws_ok($q$SELECT pg_temp.mark(0,7)$q$,'22023','Invalid station assessment','Score cannot exceed the station maximum');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveRubric","stationId":"e8000000-0000-4000-8000-000000000100","expectedVersion":1,"questionId":"e8000000-0000-4000-8000-000000000002","rubric":"Updated globally"}')$q$,'Shared rubric updates while the round is live');
SELECT is((SELECT data->'stations'->0->'questions'->0->>'rubric' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Updated globally','Active round sees latest shared rubric');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{phaseDeadline}',to_jsonb(now()-interval '2 minutes')) WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT lives_ok($q$SELECT pg_temp.round_cmd('tick')$q$,'A reconnect normalizes elapsed server deadlines');
SELECT is((SELECT data->>'phase' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'feedback','Late reconnect skips already elapsed question time');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('finishFeedback')$q$,'Assigned tutor finishes feedback');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('next')$q$,'Any tutor advances when occupied stations finish; idle station needs no feedback action');
SELECT is((SELECT data->'progress'->1->>'studentId' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'10000000-0000-0000-0000-000000000001','Online student rotates to the second station');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"next","roundId":"e8000000-0000-4000-8000-000000000020","commandId":"e8000000-0000-4000-8000-000000000099","expectedVersion":1}')$q$,'PT409','Round changed; reload before trying again','Stale simultaneous advance cannot skip a rotation');
SELECT pg_temp.round_cmd('ready','{"ready":true}');
SELECT pg_temp.round_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011');
SELECT pg_temp.round_cmd('startReading','{"overrideMissingStudents":true}');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{phaseDeadline}',to_jsonb(now()-interval '2 minutes')) WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT pg_temp.round_cmd('tick');
SELECT pg_temp.round_cmd('finishFeedback','{}','00000000-0000-0000-0000-000000000011');
SELECT pg_temp.round_cmd('next');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('release')$q$,'22023','Every station needs a completed score or an explicit not-assessed reason before release','Missing score blocks release instead of silently becoming zero');
-- Fixture a wholly missed station rather than a marked zero. An explicit
-- post-round score is itself the tutor's audited resolution of that station.
UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts}',(SELECT jsonb_agg(a || CASE WHEN a->>'stationId'='e8000000-0000-4000-8000-000000000013' THEN '{"completed":false}'::jsonb ELSE '{}'::jsonb END) FROM jsonb_array_elements(data->'attempts') a)) WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT lives_ok($q$SELECT pg_temp.mark(1,0)$q$,'Tutor explicitly awards zero to resolve a missed station');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('release')$q$,'Explicit post-round zero resolves the incomplete station and permits release');
SELECT lives_ok($q$SELECT pg_temp.mark(1,NULL,'Connection failed; not assessed')$q$,'Assigned tutor can explicitly resolve missed station');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('release')$q$,'Any participant may explicitly release ready results');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT data->'result'->>'score' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'6.25','Released total includes fractional score');
SELECT is((SELECT (data->'result'->>'possiblePoints')::numeric FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),6.5::numeric,'Not-assessed station is excluded from denominator');
SELECT is((SELECT data->'result'->>'partial' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'true','Result is labelled partial');
SELECT is((SELECT data->'resultStations'->0->>'name' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'','Student result never exposes internal station names');
SELECT is((SELECT data->'resultStations'->0->'questions'->0->'rubric' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'null'::jsonb,'Student result does not expose the rubric');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT pg_temp.mark(0,4.5);
SELECT pg_temp.general_note('"Improve the overall summary"');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT data->'result'->>'score' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'6.25','Draft correction does not silently replace published result');
SELECT is((SELECT data->'result'->'attempts'->0->>'generalFeedback' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Overall empathy','General feedback correction stays private until updated release');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT pg_temp.round_cmd('release');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT data->'result'->>'score' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'4.5','Explicit updated release publishes the correction');
SELECT is((SELECT data->'result'->'attempts'->0->>'generalFeedback' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Improve the overall summary','Updated release publishes general feedback correction');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT snapshot->>'score' FROM public.vtutor_interview_result_releases WHERE round_id='e8000000-0000-4000-8000-000000000020' AND (snapshot->>'partial')::boolean ORDER BY revision LIMIT 1),'6.25','Earlier published snapshot remains immutable after draft correction and updated release');
SELECT is((SELECT count(*) FROM public.vtutor_interview_result_releases WHERE round_id='e8000000-0000-4000-8000-000000000020'),3::bigint,'Every explicit publication retains a separate revision');
RESET ROLE;
-- A transport retry uses the same command identity and returns the same outcome.
SELECT is(pg_temp.cmd('{"type":"saveTag","commandId":"e8000000-0000-4000-8000-000000000090","tag":{"id":"e8000000-0000-4000-8000-000000000091","name":"Communication"}}'),
 pg_temp.cmd('{"type":"saveTag","commandId":"e8000000-0000-4000-8000-000000000090","tag":{"id":"e8000000-0000-4000-8000-000000000091","name":"Communication"}}'),'Identical transport retry returns original receipt');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveTag","commandId":"e8000000-0000-4000-8000-000000000090","tag":{"id":"e8000000-0000-4000-8000-000000000091","name":"Different payload"}}')$q$,'22023','Command ID already used','Reusing idempotency key for different intent is rejected');
CREATE FUNCTION pg_temp.physical_cmd(kind text,extra jsonb DEFAULT '{}',actor uuid DEFAULT '00000000-0000-0000-0000-000000000010') RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type',kind,'roundId','e8000000-0000-4000-8000-000000000030','expectedVersion',
 (SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000030'))||extra,actor);
$$;
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"createRound","roundId":"e8000000-0000-4000-8000-000000000030","setup":{"interviewId":"e8000000-0000-4000-8000-000000000010","name":"In-person mock","delivery":"in_person","mode":"feedback","recordingEnabled":true,"scheduledAt":null,"studentIds":["10000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000002"],"assignments":[{"stationId":"e8000000-0000-4000-8000-000000000011","tutorId":"00000000-0000-0000-0000-000000000010"},{"stationId":"e8000000-0000-4000-8000-000000000013","tutorId":"00000000-0000-0000-0000-000000000011"}]}}')$q$,'In-person round accepts enrolled students');
SELECT pg_temp.physical_cmd('start');
SELECT is((SELECT data->'progress'->0->'studentId' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000030'),'null'::jsonb,'Physical stations start without a system-assigned order');
SELECT lives_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}')$q$,'Tutor chooses arriving student in waiting time');
SELECT throws_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}','00000000-0000-0000-0000-000000000011')$q$,'22023','Student is already at another station or not in this round','A second tutor cannot claim the same student');
CREATE FUNCTION pg_temp.physical_general(student_id text,note jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId',r.id,'attemptId',a->'id','expectedAttemptVersion',a->'version',
 'score',NULL,'notAssessedReason',NULL,'feedback','[]'::jsonb,'generalFeedback',note))
 FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'=student_id;
$$;
SELECT pg_temp.physical_general('10000000-0000-0000-0000-000000000001','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Overall station note"}]}]}');
SELECT throws_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000002"}')$q$,'22023','Confirm moving existing feedback and score','General-only feedback requires student correction confirmation');
SELECT pg_temp.physical_general('10000000-0000-0000-0000-000000000002','"Existing target feedback"');
SELECT throws_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000002","confirmMove":true}')$q$,'22023','Target student already has assessment entries','Correction cannot overwrite target general feedback');
SELECT pg_temp.physical_general('10000000-0000-0000-0000-000000000002','null');
SELECT lives_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000002","confirmMove":true}')$q$,'Confirmed correction moves general-only feedback');
SELECT is((SELECT a->'generalFeedback'->'content'->0->'content'->0->>'text' FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000002'),'Overall station note','Corrected student receives rich general feedback');
SELECT is((SELECT a->'generalFeedback' FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000001'),'null'::jsonb,'General feedback is cleared from the former student');
SELECT pg_temp.physical_general('10000000-0000-0000-0000-000000000002','{"type":"doc","content":[{"type":"paragraph"}]}');
SELECT lives_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}')$q$,'Empty rich text does not require a move confirmation');
CREATE FUNCTION pg_temp.physical_mark() RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId',r.id,'attemptId',a->'id','expectedAttemptVersion',a->'version','score',3,'notAssessedReason',NULL,
 'feedback',jsonb_build_array(jsonb_build_object('placementId','e8000000-0000-4000-8000-000000000002','value','Notes for arriving student'))))
 FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000001';
$$;
SELECT pg_temp.physical_mark();
SELECT throws_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000002"}')$q$,'22023','Confirm moving existing feedback and score','Student correction with existing notes requires confirmation');
SELECT lives_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000002","confirmMove":true}')$q$,'Confirmed correction moves the assessment');
SELECT is((SELECT a->>'score' FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000002'),'3','Correct student receives confirmed score');
SELECT is((SELECT a->'score' FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000030' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000001'),'null'::jsonb,'Former student no longer has the moved score');
-- Clear notes through the public command to prove recording-only correction
-- still requires confirmation, even before any audio bytes have reached server.
SELECT pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId',r.id,'attemptId',a->'id','expectedAttemptVersion',a->'version','score',NULL,'notAssessedReason',NULL,'feedback','[]'::jsonb))
FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000030'
 AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000002';
SELECT is(public.interview_audio_capture('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000010'),NULL::jsonb,'Waiting time cannot create a recording capture');
SELECT pg_temp.physical_cmd('ready','{"ready":true}');
SELECT pg_temp.physical_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011');
SELECT pg_temp.physical_cmd('startReading');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{phaseDeadline}',to_jsonb(now()-interval '1 second')) WHERE id='e8000000-0000-4000-8000-000000000030';
SELECT pg_temp.physical_cmd('tick');
CREATE TEMP TABLE audio_capture AS SELECT public.interview_audio_capture('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000010') AS data;
SELECT ok((SELECT data->>'id' IS NOT NULL FROM audio_capture),'Question time creates a durable capture before uploading bytes');
SELECT is(public.interview_audio_capture('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000010'),(SELECT data FROM audio_capture),'Repeated capture request returns the same capture');
SELECT throws_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}')$q$,'22023','Confirm moving existing feedback and score','Pending recording requires confirmation despite no written entries');
SELECT lives_ok($q$SELECT pg_temp.physical_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001","confirmMove":true}')$q$,'Confirmed correction moves the pending capture');
SELECT throws_ok($q$SELECT public.interview_audio_segment('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000011',(SELECT (data->>'id')::uuid FROM audio_capture),'e8000000-0000-4000-8000-000000000081','wrong/path.webm')$q$,'42501','Audio capture unavailable','Another tutor cannot upload into the capture');
SELECT throws_ok($q$SELECT public.interview_audio_segment('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000010',(SELECT (data->>'id')::uuid FROM audio_capture),'e8000000-0000-4000-8000-000000000081','wrong/path.webm')$q$,'22023','Invalid audio storage path','Upload path must match its exact round, capture and segment');
CREATE FUNCTION pg_temp.upload_segment(segment uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_audio_segment('e8000000-0000-4000-8000-000000000030','00000000-0000-0000-0000-000000000010',(data->>'id')::uuid,segment,
  'e8000000-0000-4000-8000-000000000030/'||(data->>'id')||'/'||segment||'.webm') FROM audio_capture;
$$;
SELECT is(pg_temp.upload_segment('e8000000-0000-4000-8000-000000000081')->>'attemptId',
 (SELECT a->>'id' FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000030'
 AND a->>'stationId'='e8000000-0000-4000-8000-000000000011' AND a->>'studentId'='10000000-0000-0000-0000-000000000001'),
 'Offline segment resolves to corrected student when it eventually arrives');
SELECT is(pg_temp.upload_segment('e8000000-0000-4000-8000-000000000081'),pg_temp.upload_segment('e8000000-0000-4000-8000-000000000081'),'Audio upload retries preserve segment identity');
SELECT is((SELECT jsonb_array_length(data->'recordings') FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000030'),1,'Real segment replaces pending anchor in displayed recording list');
-- Release the capture as part of an otherwise completed fixture, then show that
-- queued bytes from that known capture may finish processing after release.
UPDATE public.interview_rounds SET data=data || jsonb_build_object('phase','completed','phaseDeadline',NULL,'attempts',
 (SELECT jsonb_agg(a || jsonb_build_object('score',1,'completed',true)) FROM jsonb_array_elements(data->'attempts') a)) WHERE id='e8000000-0000-4000-8000-000000000030';
SELECT pg_temp.physical_cmd('release');
SELECT pg_temp.upload_segment('e8000000-0000-4000-8000-000000000082');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT jsonb_array_length(data->'result'->'recordings') FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000030'),2,'Late segments of a released capture become visible as processing completion');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT jsonb_array_length(data->'result'->'recordings') FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000030'),0,'Original mistaken student cannot see corrected audio');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE TEMP TABLE old_lease AS SELECT * FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030');
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030')),0::bigint,'Active media lease prevents a concurrent worker');
UPDATE public.interview_media_jobs SET lease_until=now()-interval '1 second' WHERE round_id='e8000000-0000-4000-8000-000000000030';
CREATE TEMP TABLE new_lease AS SELECT * FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030');
SELECT public.interview_complete_media_job(round_id,revision,lease_token) FROM old_lease;
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030')),0::bigint,'Stale acknowledgement cannot clear the replacement worker lease');
SELECT public.interview_complete_media_job(round_id,revision,lease_token) FROM new_lease;
CREATE TEMP TABLE retire_lease AS SELECT * FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030');
SELECT is((SELECT count(*) FROM retire_lease),1::bigint,'Current worker acknowledgement releases its own lease');
SELECT public.interview_complete_media_job(round_id,revision,lease_token,15,true) FROM old_lease;
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030')),0::bigint,'Stale worker cannot retire another worker job');
-- Concurrent enqueue represented by a newer revision while this worker holds
-- the lease. Retiring the old observed revision must retain the newer work.
UPDATE public.interview_media_jobs SET revision=revision+1 WHERE round_id='e8000000-0000-4000-8000-000000000030';
SELECT public.interview_complete_media_job(round_id,revision,lease_token,15,true) FROM retire_lease;
CREATE TEMP TABLE final_lease AS SELECT * FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030');
SELECT is((SELECT count(*) FROM final_lease),1::bigint,'Newly enqueued revision survives an older retirement acknowledgement');
SELECT public.interview_complete_media_job(round_id,revision,lease_token,15,true) FROM final_lease;
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e8000000-0000-4000-8000-000000000030')),0::bigint,'Settled terminal work retires only at the current leased revision');

-- Register a processing segment before release. Only that released segment may
-- become playable automatically when the provider later reports it ready.
SELECT public.interview_recording_update('e8000000-0000-4000-8000-000000000020',(SELECT (a->>'id')::uuid FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000020' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011'),'released-provider-segment','pending','video');
SELECT pg_temp.round_cmd('release');
SELECT public.interview_recording_update('e8000000-0000-4000-8000-000000000020',(SELECT (a->>'id')::uuid FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000020' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011'),'released-provider-segment','ready','video','private/provider-key');
SELECT public.interview_recording_update('e8000000-0000-4000-8000-000000000020',(SELECT (a->>'id')::uuid FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e8000000-0000-4000-8000-000000000020' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011'),'not-released-provider-segment','ready','video','private/other-key');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT data->'result'->'recordings'->0->>'state' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'ready','Released recording readiness updates after provider processing');
SELECT is((SELECT jsonb_array_length(data->'result'->'recordings') FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),1,'Later un-released recording remains hidden');
SELECT is(public.interview_round_json(jsonb_populate_record(NULL::public.interview_rounds,'{"id":"e8000000-0000-4000-8000-000000000020"}')),NULL::jsonb,'Student cannot bypass tutor scope by invoking composite projection directly');
RESET ROLE;
UPDATE public.interview_recordings SET expires_at=now()-interval '1 second' WHERE provider_id='released-provider-segment';
SET LOCAL ROLE authenticated;
SELECT is((SELECT data->'result'->'recordings'->0->>'state' FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'expired','Expired recording is marked unavailable even before cleanup runs');
RESET ROLE;

UPDATE public.classes_students SET unenrolled_at=now()-interval '1 day',unenrolled_by='00000000-0000-0000-0000-000000000001' WHERE student_id='10000000-0000-0000-0000-000000000001' AND class_id='20000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),0::bigint,'Past results disappear when interview enrolment ends');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
