BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
SELECT has_function('public','interview_observer_state',ARRAY['uuid','uuid','text'],'Admin observer has a compact authoritative public RPC');
SELECT lives_ok($$SELECT public.interview_observer_state('e4882000-0000-4000-8000-000000000001')$$,'A missing round read is safe');
INSERT INTO public.interview_categories(id,name) VALUES('e4882000-0000-4000-8000-000000000010','Observer fixture');
INSERT INTO public.interview_stations(id,name,category_id,prompt,maximum_points)
VALUES('e4882000-0000-4000-8000-000000000011','Motivation','e4882000-0000-4000-8000-000000000010','"Current bank prompt"',6);
INSERT INTO public.interview_questions(id,station_id,position,tag_ids,question,rubric,rubric_version,suggested_time_seconds)
VALUES('e4882000-0000-4000-8000-000000000012','e4882000-0000-4000-8000-000000000011',0,'{}','"Current bank wording"','"Current bank rubric"',2,60);
INSERT INTO public.interviews(id,data) VALUES('e4882000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000000',
 '00000000-0000-0000-0000-000000000010',ARRAY['00000000-0000-0000-0000-000000000010']::uuid[],
 ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],jsonb_build_object(
 'name','Observer fixture','delivery','online','mode','exam','recordingEnabled',true,
 'startedAt',now()-interval '5 minutes','phase','reading','phaseDeadline',now()-interval '10 seconds',
 'phaseStartedAt',now()-interval '70 seconds','questionTimeSeconds',60,'rotation',0,
 'readingTimeSeconds',60,'pausedAt',NULL,'remainingMilliseconds',NULL,
 'students',jsonb_build_array(jsonb_build_object('id','10000000-0000-0000-0000-000000000001','name','Student')),
 'tutors',jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-000000000010','name','Tutor')),
 'stations',jsonb_build_array(jsonb_build_object('id','e4882000-0000-4000-8000-000000000013',
 'name','Motivation','prompt','Frozen prompt','maximumPoints',6,'questions',jsonb_build_array(
 jsonb_build_object('id','e4882000-0000-4000-8000-000000000014','questionId','e4882000-0000-4000-8000-000000000012',
 'question','Frozen question','rubric','Old frozen rubric','rubricVersion',1)))),
 'progress',jsonb_build_array(jsonb_build_object('stationId','e4882000-0000-4000-8000-000000000013',
 'tutorId','00000000-0000-0000-0000-000000000010','studentId','10000000-0000-0000-0000-000000000001',
 'ready',true,'endedEarly',false,'feedbackComplete',false)),
 'attempts',jsonb_build_array(jsonb_build_object('id','e4882000-0000-4000-8000-000000000015',
 'stationId','e4882000-0000-4000-8000-000000000013','studentId','10000000-0000-0000-0000-000000000001',
 'score',4,'generalFeedback','Strong reflection','feedback',jsonb_build_array(jsonb_build_object(
 'placementId','e4882000-0000-4000-8000-000000000014','value','Answered clearly'))))));
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->>'phase','questions','Observer clock advances automatically without a tutor write');
SELECT ok(NOT has_function_privilege('anon','public.interview_observer_state(uuid,uuid,text)','EXECUTE'),'Anon cannot execute observer projection');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_observer_state(uuid,uuid,text)','EXECUTE'),'Browser roles cannot bypass the Admin API');
SELECT ok(has_function_privilege('service_role','public.interview_observer_state(uuid,uuid,text)','EXECUTE'),'Service can execute the verified Admin read');
SELECT ok(NOT (public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round' ?| ARRAY['attempts','phaseHistory','releasedResults']), 'Frequent overview read excludes rich assessment/history bodies');
SELECT ok(NOT (public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'stations'->0 ?| ARRAY['prompt','questions']), 'Overview stations have counts instead of question/rubric bodies');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'stations'->0->>'questionCount','1','Station question count is retained');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'progress'->0->>'answeredQuestionCount','1','Answered count follows nonempty feedback');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'content','null'::jsonb,'Overview has no selected content');
INSERT INTO public.interview_recordings(id,round_id,attempt_id,provider_id,state,kind,expires_at)
VALUES('e4882000-0000-4000-8000-000000000016','e4882000-0000-4000-8000-000000000001',
 'e4882000-0000-4000-8000-000000000015','observer-test-recording','ready','video',now()-interval '1 second');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'recordings',
 public.interview_media_state('e4882000-0000-4000-8000-000000000001')->'recordings','Recording availability and expiry match the canonical observer read');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'recordings'->0->>'state','expired','Recording expiry is fresh even without a round write');
CREATE TEMP TABLE observer_reads AS SELECT public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013') state;
SELECT is((SELECT state->'content'->'station'->>'prompt' FROM observer_reads),'Frozen prompt','Selected station retains frozen reading prompt');
SELECT is((SELECT state->'content'->'station'->'questions'->0->>'question' FROM observer_reads),'Frozen question','Selected station retains frozen question wording');
SELECT is((SELECT state->'content'->'station'->'questions'->0->>'rubric' FROM observer_reads),'Current bank rubric','Selected station receives current rubric');
SELECT is((SELECT state->'content'->'attempt'->>'generalFeedback' FROM observer_reads),'Strong reflection','Selected station retains live feedback');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013',
 (SELECT state->>'contentRevision' FROM observer_reads))->'content','null'::jsonb,'Unchanged selected content is omitted from the next live read');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{phase}','"completed"') WHERE id='e4882000-0000-4000-8000-000000000001';
UPDATE public.interview_questions SET rubric='"Corrected live guidance"',rubric_version=rubric_version+1,updated_at=now()
WHERE id='e4882000-0000-4000-8000-000000000012';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013',
 (SELECT state->>'contentRevision' FROM observer_reads))->'content'->'station'->'questions'->0->>'rubric','Corrected live guidance',
 'Completed-round rubric changes invalidate content without changing round.version');
UPDATE observer_reads SET state=public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts,0,generalFeedback}','"Updated station feedback"') WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013',
 (SELECT state->>'contentRevision' FROM observer_reads))->'content'->'attempt'->>'generalFeedback','Updated station feedback','Selected feedback changes invalidate the content token');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts,0,feedback,0,value}','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"  "}]}]}') WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'progress'->0->>'answeredQuestionCount','0','Empty rich-text documents remain unanswered');
UPDATE public.interview_rounds SET data=data || jsonb_build_object('phase','reading','phaseDeadline',now()-interval '5 minutes','pausedAt',now(),'remainingMilliseconds',30000)
WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->>'phase','reading','A paused reading deadline never advances');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->>'remainingMilliseconds','30000','Paused timer remaining value is preserved');
INSERT INTO public.interview_presence(round_id,student_id,last_seen_at) VALUES('e4882000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001',now()-interval '36 seconds');
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'connectedStudentIds','[]'::jsonb,'Expired student presence is omitted');
UPDATE public.interview_presence SET last_seen_at=now() WHERE round_id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'connectedStudentIds',
 '["10000000-0000-0000-0000-000000000001"]'::jsonb,'Student rejoin is visible without an assessment write');

-- Compare the actual old/new public observer interfaces, rather than assuming
-- that a prepared round and a completed round hydrate content alike.
CREATE TEMP TABLE observer_phases AS SELECT data original FROM public.interview_rounds WHERE id='e4882000-0000-4000-8000-000000000001';
UPDATE public.interview_rounds SET data=(SELECT original FROM observer_phases) || jsonb_build_object('phase','waiting','pausedAt',NULL,'phaseDeadline',NULL,'startedAt',NULL)
WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013')->'content'->'station',
 public.interview_media_state('e4882000-0000-4000-8000-000000000001')->'stations'->0,'Unstarted selected content matches rich observer');
UPDATE public.interview_rounds SET data=data || jsonb_build_object('phase','questions','startedAt',now()-interval '5 minutes')
WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013')->'content'->'station',
 public.interview_media_state('e4882000-0000-4000-8000-000000000001')->'stations'->0,'Active selected content matches rich observer');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{phase}','"completed"') WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013')->'content'->'station',
 public.interview_media_state('e4882000-0000-4000-8000-000000000001')->'stations'->0,'Completed selected content matches rich observer');
-- Preserve an actual fallback prompt on old snapshots that stored it only on
-- their first question. A score alone must not make a question answered.
UPDATE public.interview_rounds SET data=jsonb_set(data #- '{stations,0,prompt}',
 '{stations,0,questions,0,prompt}','"Legacy question prompt"') WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013')->'content'->'station'->>'prompt','Legacy question prompt','Legacy reading prompt fallback is retained');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts,0,feedback,0}',
 '{"placementId":"e4882000-0000-4000-8000-000000000014","score":4,"value":{"type":"doc","content":[{"type":"paragraph"}]}}')
WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001')->'round'->'progress'->0->>'answeredQuestionCount','0','Score-only feedback is unanswered');
SELECT ok(public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000099')->'content'='null'::jsonb,'Missing selected station returns live round without foreign content');
-- Transactional sentinels prove the actual frequent public RPC does not enter
-- the old expensive full-round/timing pipeline.
CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Rich observer projection forbidden'; END; $$;
CREATE OR REPLACE FUNCTION public.interview_effective_state(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Timing projection forbidden'; END; $$;
SELECT lives_ok($$SELECT public.interview_observer_state('e4882000-0000-4000-8000-000000000001','e4882000-0000-4000-8000-000000000013')$$,'Actual selected observer read bypasses rich round/timing projection');
UPDATE public.interview_rounds SET data=jsonb_set(data,'{deletedAt}',to_jsonb(now())) WHERE id='e4882000-0000-4000-8000-000000000001';
SELECT is(public.interview_observer_state('e4882000-0000-4000-8000-000000000001'),NULL::jsonb,'Deleted rounds have no observer read');
SELECT * FROM finish();
ROLLBACK;
