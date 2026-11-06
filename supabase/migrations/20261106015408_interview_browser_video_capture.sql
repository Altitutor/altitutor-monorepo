-- Browser captures are private Storage takes. The existing 'audio' media
-- session kind denotes a local capture anchor that Daily lifecycle jobs skip.
UPDATE storage.buckets
SET allowed_mime_types=ARRAY['audio/webm','audio/mp4','audio/ogg','video/webm','video/mp4']
WHERE id='interview-recordings';

CREATE FUNCTION public.interview_video_capture(p_round_id uuid,p_tutor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 r public.interview_rounds;
 d jsonb;
 progress jsonb;
 attempt jsonb;
 capture public.interview_media_sessions;
 capture_key text;
 capture_id uuid;
 allowed boolean;
 finalized boolean;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR p_tutor_id IS NULL OR NOT(p_tutor_id=ANY(r.tutor_ids)) THEN
  RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501';
 END IF;
 d:=public.interview_effective_state(r.data);
 SELECT value INTO progress FROM jsonb_array_elements(d->'progress') WHERE value->>'tutorId'=p_tutor_id::text;
 SELECT value INTO attempt FROM jsonb_array_elements(d->'attempts') WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=progress->>'studentId';
 IF d->>'delivery'<>'online' OR NOT coalesce((d->>'recordingEnabled')::boolean,false) OR attempt IS NULL
  OR coalesce((progress->>'feedbackComplete')::boolean,false) OR d->>'phase' IN ('waiting','reading','completed')
  OR d->>'mode'='exam' AND (d->>'phase'='feedback' OR coalesce((progress->>'endedEarly')::boolean,false))
  THEN RETURN NULL; END IF;

 capture_key:='browser-video:'||r.id||':'||p_tutor_id||':'||(attempt->>'id');
 SELECT * INTO capture FROM public.interview_media_sessions WHERE phase_key=capture_key;
 allowed:=d->>'pausedAt' IS NULL AND (d->>'phase'='questions' OR d->>'mode'='feedback' AND d->>'phase'='feedback');
 IF capture.id IS NULL AND allowed THEN
  capture_id:=gen_random_uuid();
  INSERT INTO public.interview_media_sessions(id,round_id,attempt_id,tutor_id,kind,phase_key,room_name,expires_at,recording_enabled)
   VALUES(capture_id,r.id,(attempt->>'id')::uuid,p_tutor_id,'audio',capture_key,'browser-video:'||capture_id,now()+interval '4 hours',true) RETURNING * INTO capture;
  INSERT INTO public.interview_recordings(id,round_id,attempt_id,capture_id,provider_id,state,kind)
   VALUES(capture.id,r.id,capture.attempt_id,capture.id,'pending:browser-video:'||capture.id,'pending','video');
 END IF;
 IF capture.id IS NULL OR capture.expires_at<=now() THEN RETURN NULL; END IF;
 finalized:=EXISTS(SELECT 1 FROM public.interview_recordings WHERE id=capture.id AND state='ready');
 RETURN jsonb_build_object('id',capture.id,'attemptId',capture.attempt_id,'expiresAt',capture.expires_at,
  'finalized',finalized,'recordingEnabled',allowed AND NOT finalized);
END;
$$;

-- Reserving a path before issuing the immutable URL keeps uploads retryable
-- and lets the existing expiry worker remove an abandoned uploaded object.
CREATE FUNCTION public.interview_video_capture_upload(p_round_id uuid,p_tutor_id uuid,p_capture_id uuid,p_action text,p_storage_path text,p_started_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 r public.interview_rounds;
 capture public.interview_media_sessions;
 take public.interview_recordings;
 prefix text;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 SELECT * INTO capture FROM public.interview_media_sessions WHERE id=p_capture_id AND round_id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR r.data->>'delivery'<>'online' OR NOT coalesce((r.data->>'recordingEnabled')::boolean,false)
  OR p_tutor_id IS NULL OR NOT(p_tutor_id=ANY(r.tutor_ids)) OR capture.id IS NULL OR capture.kind<>'audio'
  OR capture.phase_key NOT LIKE 'browser-video:%' OR capture.tutor_id IS DISTINCT FROM p_tutor_id OR NOT capture.recording_enabled
  OR NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(r.data->'attempts') attempt
   JOIN LATERAL jsonb_array_elements(r.data->'assignments') assignment ON assignment->>'stationId'=attempt->>'stationId'
   WHERE attempt->>'id'=capture.attempt_id::text AND assignment->>'tutorId'=p_tutor_id::text
  ) THEN RAISE EXCEPTION 'Video capture unavailable' USING ERRCODE='42501'; END IF;

 SELECT * INTO take FROM public.interview_recordings WHERE id=p_capture_id AND round_id=p_round_id FOR UPDATE;
 IF take.id IS NULL OR take.kind<>'video' OR take.capture_id IS DISTINCT FROM capture.id
  OR take.attempt_id IS DISTINCT FROM capture.attempt_id OR take.expires_at<=now() OR take.state NOT IN ('pending','ready')
  THEN RAISE EXCEPTION 'Video capture unavailable' USING ERRCODE='42501'; END IF;
 prefix:=r.id::text||'/'||capture.id::text||'/'||capture.id::text;
 IF p_action IS NULL OR p_action NOT IN ('prepare','complete') OR p_storage_path IS NULL OR p_storage_path NOT IN (prefix||'.webm',prefix||'.mp4')
  OR p_started_at IS NULL OR p_started_at<capture.created_at-interval '30 seconds' OR p_started_at>now() OR p_started_at>capture.expires_at
  THEN RAISE EXCEPTION 'Invalid video upload metadata' USING ERRCODE='22023'; END IF;
 IF take.storage_path IS NOT NULL AND (take.storage_path IS DISTINCT FROM p_storage_path OR take.started_at IS DISTINCT FROM p_started_at)
  THEN RAISE EXCEPTION 'Video capture identity already used' USING ERRCODE='23505'; END IF;
 IF take.state='ready' THEN RETURN jsonb_build_object('id',take.id,'complete',true); END IF;
 IF p_action='prepare' THEN
  -- Storage grants last two hours. Keep their lifetime inside the take's
  -- retention window, including time for the route to request the grant.
  IF take.expires_at<=clock_timestamp()+interval '2 hours 10 minutes' THEN
   RAISE EXCEPTION 'Video capture is too close to expiry for a new upload' USING ERRCODE='42501';
  END IF;
  UPDATE public.interview_recordings SET storage_path=p_storage_path,started_at=p_started_at WHERE id=take.id;
  RETURN jsonb_build_object('id',take.id,'complete',false);
 END IF;
 IF take.storage_path IS NULL THEN RAISE EXCEPTION 'Video upload has not been prepared' USING ERRCODE='22023'; END IF;
 UPDATE public.interview_recordings SET state='ready' WHERE id=take.id;
 RETURN jsonb_build_object('id',take.id,'complete',true);
END;
$$;

REVOKE ALL ON FUNCTION public.interview_video_capture(uuid,uuid),public.interview_video_capture_upload(uuid,uuid,uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_video_capture(uuid,uuid),public.interview_video_capture_upload(uuid,uuid,uuid,text,text,timestamptz) TO service_role;
