BEGIN;
SELECT no_plan();
INSERT INTO public.interviews(id,data) VALUES('e4520000-0000-4000-8000-000000000001','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES ('e4520000-0000-4000-8000-000000000002','e4520000-0000-4000-8000-000000000001',
 '00000000-0000-0000-0000-000000000010',ARRAY['00000000-0000-0000-0000-000000000010']::uuid[],ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],
 '{"delivery":"in_person","mode":"feedback","phase":"questions","rotation":0,"recordingEnabled":true,"pausedAt":null,"stations":[],"progress":[{"stationId":"station","tutorId":"00000000-0000-0000-0000-000000000010","studentId":"10000000-0000-0000-0000-000000000001"}],"assignments":[{"stationId":"station","tutorId":"00000000-0000-0000-0000-000000000010"}],"attempts":[{"id":"e4520000-0000-4000-8000-000000000003","stationId":"station","studentId":"10000000-0000-0000-0000-000000000001"}]}');

-- Observe the real public capture RPC's error boundary, including its SQLSTATE.
CREATE FUNCTION pg_temp.capture_outcome(operation text,round_id uuid,tutor_id uuid) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE detail text; message text; code text; result jsonb;
BEGIN
 IF operation='audio' THEN result:=public.interview_audio_capture(round_id,tutor_id);
 ELSE result:=public.interview_video_capture(round_id,tutor_id); END IF;
 RETURN jsonb_build_object('result',result);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS detail=PG_EXCEPTION_DETAIL,message=MESSAGE_TEXT,code=RETURNED_SQLSTATE;
 RETURN jsonb_build_object('code',code,'message',message,'guard',nullif(detail,'')::jsonb);
END;
$$;
SELECT ok(NOT has_function_privilege('anon','public.interview_audio_capture(uuid,uuid)','EXECUTE'),'Anon cannot call audio guard diagnostics');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_audio_capture(uuid,uuid)','EXECUTE'),'Authenticated users cannot call audio guard diagnostics directly');
SELECT ok(NOT has_function_privilege('anon','public.interview_video_capture(uuid,uuid)','EXECUTE'),'Anon cannot call video guard diagnostics');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_video_capture(uuid,uuid)','EXECUTE'),'Authenticated users cannot call video guard diagnostics directly');
SELECT ok(has_function_privilege('service_role','public.interview_audio_capture(uuid,uuid)','EXECUTE') AND has_function_privilege('service_role','public.interview_video_capture(uuid,uuid)','EXECUTE'),'Service role retains both capture operations');
SELECT isnt(public.interview_audio_capture('e4520000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000010'),NULL::jsonb,'Assigned in-person tutor still receives a capture');
UPDATE public.interview_rounds SET tutor_ids=ARRAY['00000000-0000-0000-0000-000000000011']::uuid[] WHERE id='e4520000-0000-4000-8000-000000000002';
CREATE TEMP TABLE denied_guard AS SELECT pg_temp.capture_outcome('audio','e4520000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000010') outcome;
SELECT is((SELECT outcome FROM denied_guard),'{"code":"42501","message":"Round access denied","guard":{"version":1,"operation":"interview_audio_capture","roundId":"e4520000-0000-4000-8000-000000000002","tutorId":"00000000-0000-0000-0000-000000000010","roundExists":true,"tutorAssigned":false,"creator":true,"tutorCount":1,"storedPhase":"questions","delivery":"in_person"}}'::jsonb,'Creator-only audio denial carries the exact argument pair and guard snapshot without changing its error');
UPDATE public.interview_rounds SET tutor_ids=ARRAY['00000000-0000-0000-0000-000000000010']::uuid[] WHERE id='e4520000-0000-4000-8000-000000000002';
SELECT is((SELECT outcome->'guard'->>'tutorAssigned' FROM denied_guard),'false','Retained denial reports guard-time membership even after a subsequent assignment');
SELECT is(pg_temp.capture_outcome('audio','e4520000-0000-4000-8000-000000000099','00000000-0000-0000-0000-000000000010'),'{"code":"42501","message":"Round access denied","guard":{"version":1,"operation":"interview_audio_capture","roundId":"e4520000-0000-4000-8000-000000000099","tutorId":"00000000-0000-0000-0000-000000000010","roundExists":false,"tutorAssigned":false,"creator":false,"tutorCount":0,"storedPhase":null,"delivery":null}}'::jsonb,'Missing round audio denial is distinguished from nonparticipation');
UPDATE public.interview_rounds SET data=data||'{"delivery":"online"}'::jsonb WHERE id='e4520000-0000-4000-8000-000000000002';
SELECT isnt(public.interview_video_capture('e4520000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000010'),NULL::jsonb,'Assigned online tutor still receives a video capture');
SELECT is(pg_temp.capture_outcome('video','e4520000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000011'),'{"code":"42501","message":"Round access denied","guard":{"version":1,"operation":"interview_video_capture","roundId":"e4520000-0000-4000-8000-000000000002","tutorId":"00000000-0000-0000-0000-000000000011","roundExists":true,"tutorAssigned":false,"creator":false,"tutorCount":1,"storedPhase":"questions","delivery":"online"}}'::jsonb,'Video denial records its own operation and supplied tutor without exposing the roster');
UPDATE public.interview_rounds SET data=data||'{"phase":"completed"}'::jsonb WHERE id='e4520000-0000-4000-8000-000000000002';
SELECT is(public.interview_video_capture('e4520000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000010'),NULL::jsonb,'Completed assigned encounter still returns no capture without an authorization error');
SELECT * FROM finish();
ROLLBACK;
