-- Capture timestamps support continuous browser takes and question playback.
ALTER TABLE public.interview_recordings ADD COLUMN started_at timestamptz;
CREATE OR REPLACE FUNCTION public.interview_recording_json(r public.interview_recordings) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT jsonb_build_object('id',r.id,'attemptId',r.attempt_id,'state',CASE WHEN r.expires_at<=now() THEN 'expired' ELSE r.state END,
 'kind',r.kind,'createdAt',r.created_at,'startedAt',coalesce(r.started_at,r.created_at),'expiresAt',r.expires_at);
$$;

UPDATE storage.buckets SET file_size_limit=52428800 WHERE id='interview-recordings';

CREATE OR REPLACE FUNCTION public.interview_audio_capture(p_round_id uuid,p_tutor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; d jsonb; progress jsonb; attempt jsonb; capture public.interview_media_sessions; capture_key text; capture_id uuid; allowed boolean;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR NOT(p_tutor_id=ANY(r.tutor_ids)) THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501'; END IF;
 d:=public.interview_effective_state(r.data);
 SELECT value INTO progress FROM jsonb_array_elements(d->'progress') WHERE value->>'tutorId'=p_tutor_id::text;
 SELECT value INTO attempt FROM jsonb_array_elements(d->'attempts') WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=progress->>'studentId';
 IF d->>'delivery'<>'in_person' OR NOT coalesce((d->>'recordingEnabled')::boolean,false) OR attempt IS NULL
  OR coalesce((progress->>'feedbackComplete')::boolean,false) OR d->>'phase' IN ('waiting','reading','completed')
  OR d->>'mode'='exam' AND (d->>'phase'='feedback' OR coalesce((progress->>'endedEarly')::boolean,false)) THEN RETURN NULL; END IF;
 capture_key:='audio:'||r.id||':'||p_tutor_id||':'||(d->>'rotation')||':'||(attempt->>'id');
 SELECT * INTO capture FROM public.interview_media_sessions WHERE phase_key=capture_key;
 allowed:=d->>'pausedAt' IS NULL AND (d->>'phase'='questions' OR d->>'mode'='feedback' AND d->>'phase'='feedback');
 IF capture.id IS NULL AND allowed THEN
  capture_id:=gen_random_uuid();
  INSERT INTO public.interview_media_sessions(id,round_id,attempt_id,tutor_id,kind,phase_key,room_name,expires_at,recording_enabled)
   VALUES(capture_id,r.id,(attempt->>'id')::uuid,p_tutor_id,'audio',capture_key,'audio:'||capture_id,now()+interval '4 hours',true) RETURNING * INTO capture;
  INSERT INTO public.interview_recordings(id,round_id,attempt_id,capture_id,provider_id,state,kind)
   VALUES(capture.id,r.id,capture.attempt_id,capture.id,'audio-capture:'||capture.id,'pending','audio');
 END IF;
 IF capture.id IS NULL OR capture.expires_at<=now() THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',capture.id,'attemptId',capture.attempt_id,'expiresAt',capture.expires_at,'finalized',EXISTS(SELECT 1 FROM public.interview_recordings WHERE id=capture.id AND state='ready'));
END;
$$;

-- Six arguments are explicit so the legacy five-argument API stays unambiguous.
CREATE FUNCTION public.interview_audio_segment(p_round_id uuid,p_tutor_id uuid,p_capture_id uuid,p_segment_id uuid,p_storage_path text,p_started_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; capture public.interview_media_sessions; segment public.interview_recordings; prefix text;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 SELECT * INTO capture FROM public.interview_media_sessions WHERE id=p_capture_id AND round_id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR capture.id IS NULL OR capture.kind<>'audio' OR capture.tutor_id IS DISTINCT FROM p_tutor_id
  OR NOT(p_tutor_id=ANY(r.tutor_ids)) OR NOT capture.recording_enabled OR capture.created_at+interval '90 days'<=now()
  THEN RAISE EXCEPTION 'Audio capture unavailable' USING ERRCODE='42501'; END IF;
 prefix:=r.id::text||'/'||capture.id::text||'/'||p_segment_id::text;
 IF p_segment_id IS NULL OR p_storage_path IS NULL OR p_storage_path NOT IN (prefix||'.webm',prefix||'.mp4',prefix||'.ogg')
  THEN RAISE EXCEPTION 'Invalid audio storage path' USING ERRCODE='22023'; END IF;
 IF p_started_at IS NOT NULL AND (p_started_at<capture.created_at-interval '30 seconds' OR p_started_at>now() OR p_started_at>capture.expires_at)
  THEN RAISE EXCEPTION 'Invalid recording start time' USING ERRCODE='22023'; END IF;
 SELECT * INTO segment FROM public.interview_recordings WHERE id=p_segment_id;
 IF segment.id IS NOT NULL THEN
  IF segment.capture_id IS DISTINCT FROM capture.id OR segment.attempt_id IS DISTINCT FROM capture.attempt_id
   OR segment.storage_path IS NOT NULL AND segment.storage_path IS DISTINCT FROM p_storage_path
   THEN RAISE EXCEPTION 'Audio segment identity already used' USING ERRCODE='22023'; END IF;
  IF p_segment_id=capture.id AND segment.state='pending' THEN
   UPDATE public.interview_recordings SET storage_path=p_storage_path,state='ready',started_at=p_started_at WHERE id=p_segment_id;
  END IF;
  RETURN jsonb_build_object('id',segment.id,'attemptId',segment.attempt_id);
 END IF;
 INSERT INTO public.interview_recordings(id,round_id,attempt_id,capture_id,provider_id,state,kind,storage_path,created_at,expires_at,started_at)
 VALUES(p_segment_id,r.id,capture.attempt_id,capture.id,'audio:'||p_segment_id,'ready','audio',p_storage_path,capture.created_at,capture.created_at+interval '90 days',p_started_at);
 RETURN jsonb_build_object('id',p_segment_id,'attemptId',capture.attempt_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.interview_audio_segment(p_round_id uuid,p_tutor_id uuid,p_capture_id uuid,p_segment_id uuid,p_storage_path text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.interview_audio_segment(p_round_id,p_tutor_id,p_capture_id,p_segment_id,p_storage_path,NULL);
$$;
REVOKE ALL ON FUNCTION public.interview_audio_capture(uuid,uuid),public.interview_audio_segment(uuid,uuid,uuid,uuid,text),public.interview_audio_segment(uuid,uuid,uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_audio_capture(uuid,uuid),public.interview_audio_segment(uuid,uuid,uuid,uuid,text),public.interview_audio_segment(uuid,uuid,uuid,uuid,text,timestamptz) TO service_role;
