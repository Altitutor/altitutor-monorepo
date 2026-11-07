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
 SELECT pg_temp.cmd(jsonb_build_object('type',kind,'roundId','e8000000-0000-4000-8000-000000000020','expectedVersion',
 (SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'))||extra,actor);
$$;
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveCategory","category":{"id":"e8000000-0000-4000-8000-000000000001","name":"Personal","parentId":null}}')$q$,'Medicine tutor can create a configurable category');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e8000000-0000-4000-8000-000000000100","name":"Motivation","categoryId":"e8000000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6.5,"archived":false,"questions":[{"id":"e8000000-0000-4000-8000-000000000002","stationId":"e8000000-0000-4000-8000-000000000100","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60},{"id":"e8000000-0000-4000-8000-000000000004","stationId":"e8000000-0000-4000-8000-000000000100","tagIds":[],"question":"Follow-up?","rubric":"Listen","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e8000000-0000-4000-8000-000000000101","name":"Follow up","categoryId":"e8000000-0000-4000-8000-000000000001","prompt":"Read this scenario","maximumPoints":6,"archived":false,"questions":[{"id":"e8000000-0000-4000-8000-000000000003","stationId":"e8000000-0000-4000-8000-000000000101","tagIds":[],"question":"Why medicine?","rubric":"Listen for motivation","suggestedTimeSeconds":60}]}}')$q$,'Medicine tutor can create a station with owned questions');
SELECT is((SELECT data->'stations'->0->'questions'->0->>'question' FROM public.vtutor_interview_catalog),'Why medicine?','Saved station question is readable from tutor facade');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveRubric","stationId":"e8000000-0000-4000-8000-000000000100","expectedVersion":0,"questionId":"e8000000-0000-4000-8000-000000000002","rubric":"stale"}')$q$,'PT409','Question changed; reload before saving','Stale bank edit is rejected');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e8000000-0000-4000-8000-000000000010","name":"Mock MMI","readingTimeSeconds":60,"questionTimeSeconds":60,"recordingEnabled":true,"archived":false,"stations":[{"id":"e8000000-0000-4000-8000-000000000011","stationId":"e8000000-0000-4000-8000-000000000100"},{"id":"e8000000-0000-4000-8000-000000000013","stationId":"e8000000-0000-4000-8000-000000000101"}]}}')$q$,'Interview references complete stations with decimal maxima');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"createRound","roundId":"e8000000-0000-4000-8000-000000000020","setup":{"interviewId":"e8000000-0000-4000-8000-000000000010","name":"Practice","delivery":"online","mode":"exam","recordingEnabled":true,"scheduledAt":null,"studentIds":["10000000-0000-0000-0000-000000000001"],"assignments":[{"stationId":"e8000000-0000-4000-8000-000000000011","tutorId":"00000000-0000-0000-0000-000000000010"},{"stationId":"e8000000-0000-4000-8000-000000000013","tutorId":"00000000-0000-0000-0000-000000000011"}]}}')$q$,'A round supports fewer students than stations');
SELECT pg_temp.round_cmd('start');
SELECT pg_temp.round_cmd('ready','{"ready":true}');
SELECT pg_temp.round_cmd('ready','{"ready":true}','00000000-0000-0000-0000-000000000011');
SELECT pg_temp.round_cmd('startReading','{"overrideMissingStudents":true}');
SELECT pg_temp.round_cmd('skipReading');
CREATE FUNCTION pg_temp.current_attempt() RETURNS jsonb LANGUAGE sql AS $$
 SELECT a FROM public.vtutor_interview_rounds r CROSS JOIN jsonb_array_elements(data->'attempts') a
 WHERE r.id='e8000000-0000-4000-8000-000000000020' AND a->>'stationId'='e8000000-0000-4000-8000-000000000011';
$$;
CREATE FUNCTION pg_temp.select_question(q integer,actor uuid DEFAULT '00000000-0000-0000-0000-000000000010',command_id uuid DEFAULT gen_random_uuid()) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_command(actor,jsonb_build_object('type','selectQuestion','commandId',command_id,'roundId',r.id,
  'attemptId',pg_temp.current_attempt()->>'id','questionId',data->'stations'->0->'questions'->q->>'id'))
 FROM public.vtutor_interview_rounds r WHERE id='e8000000-0000-4000-8000-000000000020';
$$;
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'questionIntervals'),1,'Question time automatically begins one Question 1 interval');
SELECT is(pg_temp.current_attempt()->>'selectedQuestionId',(SELECT data->'stations'->0->'questions'->0->>'id' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Question 1 selected initially');
SELECT lives_ok($q$SELECT pg_temp.select_question(1,'00000000-0000-0000-0000-000000000010','e8000000-0000-4000-8000-000000000099')$q$,'Assigned tutor can switch questions without assessment version');
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'questionIntervals'),2,'A selection closes the earlier interval and starts another');
SELECT is((pg_temp.current_attempt()->>'version')::integer,1,'Navigation does not change assessment version');
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'feedback'),0,'Navigation alone does not mark a question answered');
SELECT lives_ok($q$SELECT pg_temp.select_question(1,'00000000-0000-0000-0000-000000000010','e8000000-0000-4000-8000-000000000099')$q$,'Transport retry is idempotent');
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'questionIntervals'),2,'Retry does not add an interval');
SELECT throws_ok($q$SELECT pg_temp.select_question(0,'00000000-0000-0000-0000-000000000011')$q$,'42501','Only the assigned tutor may select this question','Another station tutor cannot select questions here');
SELECT pg_temp.round_cmd('pause');
SELECT ok(pg_temp.current_attempt()->'questionIntervals'->-1->>'endedAt' IS NOT NULL,'Pause closes the current interval');
SELECT throws_ok($q$SELECT pg_temp.select_question(0)$q$,'22023','Questions are not active for this station','Selection cannot extend into paused time');
SELECT pg_temp.round_cmd('resume');
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'questionIntervals'),3,'Resume starts a new interval for the current question');
SELECT lives_ok($q$SELECT pg_temp.select_question(0)$q$,'Revisiting Question 1 records another interval');
SELECT is(jsonb_array_length(pg_temp.current_attempt()->'questionIntervals'),4,'Revisits preserve earlier intervals');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pg_temp.current_attempt()->'questionIntervals') i
 WHERE i->>'endedAt' IS NOT NULL AND (i->>'endedAt')::timestamptz<(i->>'startedAt')::timestamptz),'Selection times remain monotonic inside an older transaction');
SELECT pg_temp.round_cmd('endStation');
SELECT ok(pg_temp.current_attempt()->'questionIntervals'->-1->>'endedAt' IS NOT NULL,'Ending a station closes its question interval');
-- Fixture a second rotation at a natural server deadline; observations stay at the facade.
UPDATE public.interview_rounds SET data=jsonb_set(jsonb_set(jsonb_set(data,'{phase}','"questions"'),'{phaseDeadline}',to_jsonb(now()-interval '1 second')),'{progress,0,endedEarly}','false') WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT pg_temp.round_cmd('tick');
SELECT ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pg_temp.current_attempt()->'questionIntervals') i WHERE i->>'endedAt' IS NULL),'Natural question deadline closes every active interval');
-- A published result retains the timing evidence from release even if live JSON changes later.
UPDATE public.interview_rounds SET data=jsonb_set(jsonb_set(data,'{phase}','"completed"'),'{attempts}',(SELECT jsonb_agg(a || '{"score":3,"completed":true}'::jsonb) FROM jsonb_array_elements(data->'attempts') a)) WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT pg_temp.round_cmd('release');
CREATE TEMP TABLE timing_snapshot AS SELECT data->'releasedResults'->0->'attempts' AS attempts FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020';
UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts}',(SELECT jsonb_agg(a || '{"questionIntervals":[]}'::jsonb) FROM jsonb_array_elements(data->'attempts') a)) WHERE id='e8000000-0000-4000-8000-000000000020';
SELECT is((SELECT data->'releasedResults'->0->'attempts' FROM public.vtutor_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),(SELECT attempts FROM timing_snapshot),'Published timing is immutable after later current-attempt changes');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT ok((SELECT NOT (data ? 'attempts') FROM public.vstudent_interview_rounds WHERE id='e8000000-0000-4000-8000-000000000020'),'Student live projection does not expose current attempts');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_question_timing(jsonb,timestamp with time zone)','EXECUTE'),'Browser cannot invoke private timing projection');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
