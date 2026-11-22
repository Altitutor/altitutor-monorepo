BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT '00000000-0000-0000-0000-000000000010',id FROM public.subjects WHERE name='Medicine Interview'
ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE FUNCTION pg_temp.cmd(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_command('00000000-0000-0000-0000-000000000010',jsonb_build_object('commandId',gen_random_uuid())||p);
$$;
SELECT pg_temp.cmd('{"type":"saveCategory","category":{"id":"e4940000-0000-4000-8000-000000000001","name":"Deletion QA","parentId":null}}');
SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e4940000-0000-4000-8000-000000000002","name":"Communication","categoryId":"e4940000-0000-4000-8000-000000000001","prompt":"Scenario","maximumPoints":6,"archived":false,"questions":[{"id":"e4940000-0000-4000-8000-000000000003","stationId":"e4940000-0000-4000-8000-000000000002","tagIds":[],"question":"What would you do?","rubric":"","suggestedTimeSeconds":60}]}}');
SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e4940000-0000-4000-8000-000000000004","name":"Deletion QA","readingTimeSeconds":60,"questionTimeSeconds":60,"recordingEnabled":false,"archived":false,"stations":[{"id":"e4940000-0000-4000-8000-000000000005","stationId":"e4940000-0000-4000-8000-000000000002"}]}}');
CREATE FUNCTION pg_temp.create_round(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.cmd(jsonb_build_object('type','createRound','roundId',target,'setup',jsonb_build_object(
  'interviewId','e4940000-0000-4000-8000-000000000004','name','Abandoned interview','delivery','online','mode','feedback',
  'recordingEnabled',false,'scheduledAt',null,'studentIds',jsonb_build_array('10000000-0000-0000-0000-000000000001'),
  'assignments',jsonb_build_array(jsonb_build_object('stationId','e4940000-0000-4000-8000-000000000005','tutorId','00000000-0000-0000-0000-000000000010')))));
 PERFORM pg_temp.cmd(jsonb_build_object('type','start','roundId',target,'expectedVersion',1));
END;
$$;
CREATE FUNCTION pg_temp.deletion(target uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('type','deleteRound','roundId',target,'commandId',gen_random_uuid(),'expectedVersion',data->'version',
  'expectedAttemptVersions',(SELECT jsonb_agg(jsonb_build_object('id',a->'id','version',a->'version')) FROM jsonb_array_elements(data->'attempts') a))
 FROM public.vtutor_interview_rounds WHERE id=target;
$$;
SELECT pg_temp.create_round('e4940000-0000-4000-8000-000000000010');
SELECT lives_ok($q$SELECT pg_temp.cmd(pg_temp.deletion('e4940000-0000-4000-8000-000000000010'))$q$,
 'A tutor can delete a started round when nobody is present');
SELECT is((SELECT count(*) FROM public.vtutor_interview_rounds WHERE id='e4940000-0000-4000-8000-000000000010'),0::bigint,
 'Deleted started round disappears from the tutor facade');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"heartbeat","roundId":"e4940000-0000-4000-8000-000000000010"}')$q$,
 '22023','Round not found','Deletion rejects subsequent participation');

SELECT pg_temp.create_round('e4940000-0000-4000-8000-000000000011');
SELECT pg_temp.cmd('{"type":"heartbeat","roundId":"e4940000-0000-4000-8000-000000000011"}');
SELECT throws_ok($q$SELECT pg_temp.cmd(pg_temp.deletion('e4940000-0000-4000-8000-000000000011'))$q$,
 '22023','Someone is still in this interview. Ask everyone to leave, then refresh before deleting.',
 'A tutor still inside the interview blocks deletion, including the deleting tutor');
UPDATE public.interview_tutor_presence SET last_seen_at=now()-interval '36 seconds'
WHERE round_id='e4940000-0000-4000-8000-000000000011';
SELECT public.interview_command('10000000-0000-0000-0000-000000000001',jsonb_build_object('type','heartbeat','commandId',gen_random_uuid(),'roundId','e4940000-0000-4000-8000-000000000011'));
SELECT throws_ok($q$SELECT pg_temp.cmd(pg_temp.deletion('e4940000-0000-4000-8000-000000000011'))$q$,
 '22023','Someone is still in this interview. Ask everyone to leave, then refresh before deleting.',
 'A student still inside the interview blocks deletion');
UPDATE public.interview_presence SET last_seen_at=now()-interval '36 seconds'
WHERE round_id='e4940000-0000-4000-8000-000000000011';
SELECT lives_ok($q$SELECT pg_temp.cmd(pg_temp.deletion('e4940000-0000-4000-8000-000000000011'))$q$,
 'Expired tutor and student presence does not block deletion');

SELECT pg_temp.create_round('e4940000-0000-4000-8000-000000000012');
CREATE TEMP TABLE deletion_preview AS SELECT pg_temp.deletion('e4940000-0000-4000-8000-000000000012') command;
SELECT pg_temp.cmd(jsonb_build_object('type','saveAttempt','roundId','e4940000-0000-4000-8000-000000000012',
 'attemptId',(SELECT data->'attempts'->0->>'id' FROM public.vtutor_interview_rounds WHERE id='e4940000-0000-4000-8000-000000000012'),
 'expectedAttemptVersion',1,'score',0,'notAssessedReason',NULL,'feedback','[]'::jsonb,'generalFeedback','New assessment after the deletion preview'));
SELECT throws_ok($q$SELECT pg_temp.cmd((SELECT command FROM deletion_preview))$q$,
 'PT409','Scores or feedback changed. Refresh before deleting this round',
 'Feedback changed without a round version bump cannot be deleted using a stale preview');
SELECT is((SELECT data->'attempts'->0->>'generalFeedback' FROM public.vtutor_interview_rounds WHERE id='e4940000-0000-4000-8000-000000000012'),
 'New assessment after the deletion preview','Rejected deletion preserves the newer feedback');
SELECT throws_ok($q$SELECT pg_temp.cmd(pg_temp.deletion('e4940000-0000-4000-8000-000000000012')-'expectedAttemptVersions')$q$,
 'PT409','Refresh the scores and feedback before deleting this round','Started deletion requires a reviewed assessment revision');
CREATE TEMP TABLE final_deletion AS SELECT pg_temp.deletion('e4940000-0000-4000-8000-000000000012') command;
SELECT lives_ok($q$SELECT pg_temp.cmd((SELECT command FROM final_deletion))$q$,'A refreshed confirmation permits deletion');
SELECT lives_ok($q$SELECT pg_temp.cmd((SELECT command FROM final_deletion))$q$,'Retrying the same successful deletion command is idempotent');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_rounds WHERE id='e4940000-0000-4000-8000-000000000012'),0::bigint,
 'Student discovery no longer exposes the deleted round');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
