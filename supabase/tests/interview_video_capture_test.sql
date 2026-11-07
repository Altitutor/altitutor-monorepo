BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO public.interviews(id,data) VALUES('e8090000-0000-4000-8000-000000000010','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES (
 'e8090000-0000-4000-8000-000000000020',
 'e8090000-0000-4000-8000-000000000010',
 '00000000-0000-0000-0000-000000000010',
 ARRAY['00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011']::uuid[],
 ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],
 jsonb_build_object('delivery','online','mode','feedback','phase','reading','recordingEnabled',true,
  'phaseStartedAt',now(),'phaseDeadline',now()+interval '5 minutes','pausedAt',NULL,
  'assignments','[{"stationId":"station","tutorId":"00000000-0000-0000-0000-000000000010"}]'::jsonb,
  'progress','[{"stationId":"station","tutorId":"00000000-0000-0000-0000-000000000010","studentId":"10000000-0000-0000-0000-000000000001"}]'::jsonb,
  'attempts','[{"id":"e8090000-0000-4000-8000-000000000030","stationId":"station","studentId":"10000000-0000-0000-0000-000000000001"}]'::jsonb)
);

CREATE FUNCTION pg_temp.video_capture() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_video_capture('e8090000-0000-4000-8000-000000000020','00000000-0000-0000-0000-000000000010');
$$;
SELECT ok(NOT has_function_privilege('authenticated','public.interview_video_capture(uuid,uuid)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.interview_video_capture_upload(uuid,uuid,uuid,text,text,timestamptz)','EXECUTE'),
 'Only the service can issue or finalize an online capture');
SELECT ok((SELECT NOT public AND file_size_limit=52428800 AND allowed_mime_types @> ARRAY['video/webm','video/mp4','audio/webm','audio/mp4','audio/ogg']
 FROM storage.buckets WHERE id='interview-recordings'),'Private bucket accepts video and legacy audio under the existing limit');
SELECT is(pg_temp.video_capture(),NULL::jsonb,'Reading cannot create a video capture');
UPDATE public.interview_rounds SET data=data||jsonb_build_object('phase','questions','pausedAt',now()) WHERE id='e8090000-0000-4000-8000-000000000020';
SELECT is(pg_temp.video_capture(),NULL::jsonb,'Pause cannot start a new capture');
UPDATE public.interview_rounds SET data=data||'{"pausedAt":null}'::jsonb WHERE id='e8090000-0000-4000-8000-000000000020';
CREATE TEMP TABLE video_capture_fixture AS SELECT pg_temp.video_capture() AS take;
SELECT is(pg_temp.video_capture(),(SELECT take FROM video_capture_fixture),'Question retries reuse the one attempt capture');
SELECT is((SELECT take->>'recordingEnabled' FROM video_capture_fixture),'true','Question time permits capture');

CREATE FUNCTION pg_temp.video_upload(action text,extension text DEFAULT 'webm',tutor uuid DEFAULT '00000000-0000-0000-0000-000000000010') RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_video_capture_upload('e8090000-0000-4000-8000-000000000020',tutor,(take->>'id')::uuid,action,
 'e8090000-0000-4000-8000-000000000020/'||(take->>'id')||'/'||(take->>'id')||'.'||extension,now())
 FROM video_capture_fixture;
$$;
SELECT throws_ok($q$SELECT pg_temp.video_upload('prepare','webm','00000000-0000-0000-0000-000000000011')$q$,'42501','Video capture unavailable','Another tutor in the round cannot upload this attempt');
SELECT throws_ok($q$SELECT pg_temp.video_upload('prepare','ogg')$q$,'22023','Invalid video upload metadata','Video cannot reserve an audio-only extension');
SELECT throws_ok($q$SELECT pg_temp.video_upload('complete')$q$,'22023','Video upload has not been prepared','Unreserved bytes cannot be published');
UPDATE public.interview_recordings SET expires_at=now()+interval '1 hour' WHERE id=(SELECT (take->>'id')::uuid FROM video_capture_fixture);
SELECT throws_ok($q$SELECT pg_temp.video_upload('prepare')$q$,'42501','Video capture is too close to expiry for a new upload','A signed grant must expire before the take');
UPDATE public.interview_recordings SET expires_at=now()+interval '90 days' WHERE id=(SELECT (take->>'id')::uuid FROM video_capture_fixture);
SELECT is(pg_temp.video_upload('prepare')->>'complete','false','Prepare reserves the take without publishing it');
SELECT throws_ok($q$SELECT pg_temp.video_upload('prepare','mp4')$q$,'23505','Video capture identity already used','A retry cannot reserve a second storage path');

UPDATE public.interview_rounds SET data=data||jsonb_build_object('phase','feedback','pausedAt',now()) WHERE id='e8090000-0000-4000-8000-000000000020';
SELECT is(pg_temp.video_capture()->>'id',(SELECT take->>'id' FROM video_capture_fixture),'Paused feedback retains the existing capture identity');
SELECT is(pg_temp.video_capture()->>'recordingEnabled','false','Paused feedback cannot capture live media');
UPDATE public.interview_rounds SET data=data||'{"pausedAt":null}'::jsonb WHERE id='e8090000-0000-4000-8000-000000000020';
SELECT is(pg_temp.video_capture(),(SELECT take FROM video_capture_fixture),'Resume returns the same enabled video capture');
UPDATE public.interview_rounds SET data=data||'{"mode":"exam"}'::jsonb WHERE id='e8090000-0000-4000-8000-000000000020';
SELECT is(pg_temp.video_capture(),NULL::jsonb,'Exam marking cannot get a live capture ticket');
SELECT is(pg_temp.video_upload('complete')->>'complete','true','Previously captured media can finish uploading during marking');
SELECT is(pg_temp.video_upload('prepare'),pg_temp.video_upload('complete'),'Finalized upload retries return the same receipt');
SELECT is((SELECT count(*) FROM public.interview_recordings WHERE round_id='e8090000-0000-4000-8000-000000000020' AND state='ready' AND kind='video' AND storage_path IS NOT NULL),1::bigint,'The attempt has one ready video take');

SELECT * FROM finish();
ROLLBACK;
