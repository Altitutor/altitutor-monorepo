BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
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
 SELECT pg_temp.cmd(jsonb_build_object('type',kind,'roundId','e3751000-0000-4000-8000-000000000020','expectedVersion',
 (SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000020'))||extra,actor);
$$;
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveCategory","category":{"id":"e3751000-0000-4000-8000-000000000001","name":"Personal","parentId":null}}')$q$,'Medicine tutor can create a configurable category');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e3751000-0000-4000-8000-000000000100","name":"Motivation","categoryId":"e3751000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6.5,"archived":false,"questions":[{"id":"e3751000-0000-4000-8000-000000000002","stationId":"e3751000-0000-4000-8000-000000000100","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e3751000-0000-4000-8000-000000000101","name":"Follow up","categoryId":"e3751000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6,"archived":false,"questions":[{"id":"e3751000-0000-4000-8000-000000000003","stationId":"e3751000-0000-4000-8000-000000000101","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT is((SELECT data->'stations'->0->'questions'->0->>'question' FROM public.vtutor_interview_catalog),'Why medicine?','Saved station question is readable from tutor facade');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveRubric","stationId":"e3751000-0000-4000-8000-000000000100","expectedVersion":0,"questionId":"e3751000-0000-4000-8000-000000000002","rubric":"stale"}')$q$,'PT409','Question changed; reload before saving','Stale bank edit is rejected');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e3751000-0000-4000-8000-000000000010","name":"Mock MMI","readingTimeSeconds":60,"questionTimeSeconds":60,"recordingEnabled":true,"archived":false,"stations":[{"id":"e3751000-0000-4000-8000-000000000011","stationId":"e3751000-0000-4000-8000-000000000100"},{"id":"e3751000-0000-4000-8000-000000000013","stationId":"e3751000-0000-4000-8000-000000000101"}]}}')$q$,'Interview references complete stations with decimal maxima');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"createRound","roundId":"e3751000-0000-4000-8000-000000000020","setup":{"interviewId":"e3751000-0000-4000-8000-000000000010","name":"Practice","delivery":"in_person","mode":"feedback","recordingEnabled":true,"scheduledAt":null,"studentIds":["10000000-0000-0000-0000-000000000001"],"assignments":[{"stationId":"e3751000-0000-4000-8000-000000000011","tutorId":"00000000-0000-0000-0000-000000000010"},{"stationId":"e3751000-0000-4000-8000-000000000013","tutorId":"00000000-0000-0000-0000-000000000011"}]}}')$q$,'A round supports fewer students than stations');

SELECT pg_temp.round_cmd('start');
SELECT pg_temp.round_cmd('ready','{"ready":true}');
SELECT pg_temp.round_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('startReading')$q$,'All ready tutors may start reading before students are selected');
SELECT is((SELECT data->>'phase' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000020'),'reading','Reading begins with empty stations');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}')$q$,'Ready tutor may select a student during reading');
SELECT pg_temp.round_cmd('pause');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('claimStudent','{"studentId":null}')$q$,'22023','Cannot select a student now','Paused reading does not allow student reassignment');
SELECT pg_temp.round_cmd('resume');
SELECT pg_temp.round_cmd('skipReading');
SELECT throws_ok($q$SELECT pg_temp.round_cmd('claimStudent','{"studentId":null}')$q$,'22023','Cannot select a student now','Student selection locks when questions begin');
SELECT lives_ok($q$SELECT pg_temp.round_cmd('skipQuestions','{}','00000000-0000-0000-0000-000000000011')$q$,'Any participating tutor may skip question time for everyone');
SELECT is((SELECT data->>'phase' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000020'),'feedback','Skipping questions advances the shared phase');
SELECT is((SELECT data->'sharedAction'->>'type' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000020'),'skipQuestions','Group skip records its actor action');
SELECT is((SELECT a->'questionIntervals'->0->>'endedAt' IS NOT NULL FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a WHERE r.id='e3751000-0000-4000-8000-000000000020' AND a->>'stationId'='e3751000-0000-4000-8000-000000000011'),true,'Group skip closes the active question answering interval');
SELECT is((SELECT data->'attempts'->0->>'completed' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000020'),'false','Skipping time does not complete assessment');

CREATE FUNCTION pg_temp.planned_setup(student_id uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('interviewId','e3751000-0000-4000-8000-000000000010','name','Planned circuit','delivery','in_person','mode','feedback','recordingEnabled',true,
  'rotationAllowanceSeconds',120,'scheduledAt',now()+interval '1 day','studentIds',jsonb_build_array(student_id),
  'assignments',jsonb_build_array(jsonb_build_object('stationId','e3751000-0000-4000-8000-000000000011','tutorId','00000000-0000-0000-0000-000000000010'),
   jsonb_build_object('stationId','e3751000-0000-4000-8000-000000000013','tutorId','00000000-0000-0000-0000-000000000011')));
$$;
CREATE TEMP TABLE bulk_request AS SELECT jsonb_build_object('type','createRounds','commandId','e3751000-0000-4000-8000-000000000090','rounds',jsonb_build_array(
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000030','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001')),
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000031','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000002')))) AS body;
SELECT lives_ok($q$SELECT public.interview_command('00000000-0000-0000-0000-000000000010',(SELECT body FROM bulk_request))$q$,'One command creates the complete planned series');
SELECT is((SELECT count(*) FROM public.vtutor_interview_rounds WHERE id IN ('e3751000-0000-4000-8000-000000000030','e3751000-0000-4000-8000-000000000031')),2::bigint,'All planned rounds are visible through the tutor facade');
SELECT is(jsonb_array_length(public.interview_command('00000000-0000-0000-0000-000000000010',(SELECT body FROM bulk_request))->'roundIds'),2,'A lost-response retry returns the same complete series');
SELECT is((SELECT count(*) FROM public.vtutor_interview_rounds WHERE id IN ('e3751000-0000-4000-8000-000000000030','e3751000-0000-4000-8000-000000000031')),2::bigint,'Retry does not create additional rounds');
SELECT is((SELECT (data->>'rotationAllowanceSeconds')::integer FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000030'),120,'Configured scheduling allowance survives creation');
SELECT pg_temp.cmd(jsonb_build_object('type','start','roundId','e3751000-0000-4000-8000-000000000030','expectedVersion',1));
SELECT is((SELECT (data->>'rotationAllowanceSeconds')::integer FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000030'),120,'Starting a round preserves its scheduling allowance');
SELECT throws_ok($q$SELECT public.interview_command('10000000-0000-0000-0000-000000000001',(SELECT body FROM bulk_request))$q$,'42501','Medicine interview tutor access required','Students cannot create planned rounds');
CREATE TEMP TABLE invalid_bulk AS SELECT jsonb_build_object('type','createRounds','commandId','e3751000-0000-4000-8000-000000000091','rounds',jsonb_build_array(
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000040','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001')),
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000041','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000002') || '{"assignments":[]}'::jsonb))) AS body;
SELECT throws_ok($q$SELECT public.interview_command('00000000-0000-0000-0000-000000000010',(SELECT body FROM invalid_bulk))$q$,'22023','Invalid round participants or stations','One invalid round rejects the complete series');
SELECT is((SELECT count(*) FROM public.vtutor_interview_rounds WHERE id IN ('e3751000-0000-4000-8000-000000000040','e3751000-0000-4000-8000-000000000041')),0::bigint,'Rejected series leaves no partially created round');
SELECT throws_ok($q$SELECT pg_temp.cmd(jsonb_build_object('type','createRounds','rounds',jsonb_build_array(
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000060','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001')),
 jsonb_build_object('roundId','E3751000-0000-4000-8000-000000000060','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000002')))))$q$,'22023','Rounds and their students must be distinct','Round UUID casing cannot bypass duplicate detection');
-- This checks duplicate identity before eligibility, so synthetic UUIDs need no enrolment fixture.
SELECT throws_ok($q$SELECT pg_temp.cmd(jsonb_build_object('type','createRounds','rounds',jsonb_build_array(
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000061','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001') || '{"studentIds":["a0000000-0000-4000-8000-000000000001"]}'::jsonb),
 jsonb_build_object('roundId','e3751000-0000-4000-8000-000000000062','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000002') || '{"studentIds":["A0000000-0000-4000-8000-000000000001"]}'::jsonb))))$q$,'22023','Rounds and their students must be distinct','Student UUID casing cannot allocate one student to two groups');
SELECT throws_ok($q$SELECT pg_temp.cmd(jsonb_build_object('type','createRound','roundId','e3751000-0000-4000-8000-000000000042','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001') || '{"rotationAllowanceSeconds":-1}'::jsonb))$q$,'22023','Invalid rotation allowance','Scheduling allowance rejects negative values');
-- Transaction time remains fixed while lock waits and wall-clock deadlines pass.
-- Use the public authoring/setup commands for a one-second reading fixture.
SELECT pg_temp.cmd(jsonb_build_object('type','saveInterview','expectedVersion',1,'interview',
 (SELECT value || '{"readingTimeSeconds":1}'::jsonb FROM public.vtutor_interview_catalog c CROSS JOIN jsonb_array_elements(data->'interviews') value WHERE value->>'id'='e3751000-0000-4000-8000-000000000010')));
SELECT pg_temp.cmd(jsonb_build_object('type','createRound','roundId','e3751000-0000-4000-8000-000000000050','setup',pg_temp.planned_setup('10000000-0000-0000-0000-000000000001')));
CREATE FUNCTION pg_temp.deadline_cmd(kind text,extra jsonb DEFAULT '{}',actor uuid DEFAULT '00000000-0000-0000-0000-000000000010') RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type',kind,'roundId','e3751000-0000-4000-8000-000000000050','expectedVersion',
 (SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000050'))||extra,actor);
$$;
SELECT pg_temp.deadline_cmd('start');
SELECT pg_temp.deadline_cmd('ready','{"ready":true}');
SELECT pg_temp.deadline_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011');
SELECT pg_temp.deadline_cmd('startReading');
SELECT pg_sleep(1.1);
SELECT throws_ok($q$SELECT pg_temp.deadline_cmd('claimStudent','{"studentId":"10000000-0000-0000-0000-000000000001"}')$q$,'22023','Cannot select a student now','Reading selection cannot cross the wall-clock question deadline in an older transaction');
SELECT is((SELECT data->'progress'->0->'studentId' FROM public.vtutor_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000050'),'null'::jsonb,'Deadline rejection preserves the unselected station');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT extract(epoch FROM ((data->>'scheduledEndAt')::timestamptz-(data->>'scheduledAt')::timestamptz))::integer FROM public.vstudent_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000030'),480,'Student calendar shows two four-minute rotations without a hidden floor');
SELECT ok((SELECT NOT (data ?| ARRAY['attempts','tutors','students','rotationAllowanceSeconds']) FROM public.vstudent_interview_rounds WHERE id='e3751000-0000-4000-8000-000000000030'),'Calendar duration does not expose private round settings or assessment');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
