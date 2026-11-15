-- DEV-452: preserve authorization and capture behavior; report only the denied
-- service RPC's argument pair and the row snapshot already held by its guard.
-- No roster, identity, room, recording or user-supplied content is included.
-- storedPhase is the stored phase, not a newly calculated effective state.
-- tutorCount is capped at 10000. Existing service-role-only grants are retained.

CREATE OR REPLACE FUNCTION public.interview_audio_capture(p_round_id uuid,p_tutor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; d jsonb; progress jsonb; attempt jsonb; capture public.interview_media_sessions; capture_key text; capture_id uuid; allowed boolean;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR NOT(p_tutor_id=ANY(r.tutor_ids)) THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501', DETAIL=jsonb_build_object(
   'version',1,'operation','interview_audio_capture','roundId',p_round_id,'tutorId',p_tutor_id,
   'roundExists',r.id IS NOT NULL,'tutorAssigned',coalesce(p_tutor_id=ANY(r.tutor_ids),false),
   'creator',coalesce(r.created_by=p_tutor_id,false),'tutorCount',least(coalesce(cardinality(r.tutor_ids),0),10000),
   'storedPhase',CASE WHEN r.data->>'phase' IN ('waiting','reading','questions','feedback','completed') THEN r.data->>'phase' END,
   'delivery',CASE WHEN r.data->>'delivery' IN ('in_person','online') THEN r.data->>'delivery' END
  )::text; END IF;
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

CREATE OR REPLACE FUNCTION public.interview_video_capture(p_round_id uuid,p_tutor_id uuid) RETURNS jsonb
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
  RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501', DETAIL=jsonb_build_object(
   'version',1,'operation','interview_video_capture','roundId',p_round_id,'tutorId',p_tutor_id,
   'roundExists',r.id IS NOT NULL,'tutorAssigned',coalesce(p_tutor_id=ANY(r.tutor_ids),false),
   'creator',coalesce(r.created_by=p_tutor_id,false),'tutorCount',least(coalesce(cardinality(r.tutor_ids),0),10000),
   'storedPhase',CASE WHEN r.data->>'phase' IN ('waiting','reading','questions','feedback','completed') THEN r.data->>'phase' END,
   'delivery',CASE WHEN r.data->>'delivery' IN ('in_person','online') THEN r.data->>'delivery' END
  )::text;
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
