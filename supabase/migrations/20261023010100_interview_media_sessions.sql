-- Provider lifecycle state is private and recoverable after process failure.
CREATE TABLE public.interview_media_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 round_id uuid NOT NULL REFERENCES public.interview_rounds(id) ON DELETE CASCADE,
 attempt_id uuid NOT NULL,
 tutor_id uuid REFERENCES public.staff(id),
 kind text NOT NULL DEFAULT 'video' CHECK (kind IN ('audio','video')),
 phase_key text NOT NULL UNIQUE,
 room_name text NOT NULL UNIQUE,
 room_url text,
 expires_at timestamptz NOT NULL,
 closed_at timestamptz,
 recording_enabled boolean NOT NULL DEFAULT false,
 recording_requested_at timestamptz,
 recording_error text,
 recording_checked_at timestamptz,
 recording_active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_media_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_media_sessions FROM anon, authenticated;
GRANT ALL ON public.interview_media_sessions TO service_role;
CREATE INDEX interview_media_sessions_round ON public.interview_media_sessions(round_id);

CREATE TABLE public.interview_media_jobs (
 round_id uuid PRIMARY KEY REFERENCES public.interview_rounds(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1,
 lease_until timestamptz,
 lease_token uuid,
 next_attempt_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_media_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_media_jobs FROM anon, authenticated;
GRANT ALL ON public.interview_media_jobs TO service_role;

CREATE FUNCTION public.interview_enqueue_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.data->'phase'=NEW.data->'phase'
  AND OLD.data->'phaseStartedAt'=NEW.data->'phaseStartedAt'
  AND OLD.data->'pausedAt' IS NOT DISTINCT FROM NEW.data->'pausedAt'
  AND OLD.data->'progress'=NEW.data->'progress' THEN RETURN NEW; END IF;
 INSERT INTO public.interview_media_jobs(round_id) VALUES(NEW.id)
 ON CONFLICT(round_id) DO UPDATE SET revision=interview_media_jobs.revision+1,next_attempt_at=now();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_enqueue_media() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER interview_queue_media AFTER INSERT OR UPDATE ON public.interview_rounds
 FOR EACH ROW EXECUTE FUNCTION public.interview_enqueue_media();

CREATE FUNCTION public.interview_claim_media_job(p_round_id uuid DEFAULT NULL)
RETURNS TABLE(round_id uuid,revision bigint,lease_token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH selected AS (
  SELECT j.round_id FROM public.interview_media_jobs j
  WHERE (p_round_id IS NULL OR j.round_id=p_round_id)
   AND (p_round_id IS NOT NULL OR j.next_attempt_at<=now())
   AND (j.lease_until IS NULL OR j.lease_until<now())
  ORDER BY j.next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED
 ) UPDATE public.interview_media_jobs j SET lease_until=now()+interval '45 seconds',lease_token=gen_random_uuid()
 FROM selected s WHERE j.round_id=s.round_id RETURNING j.round_id,j.revision,j.lease_token;
$$;
CREATE FUNCTION public.interview_complete_media_job(p_round_id uuid,p_revision bigint,p_lease_token uuid,p_delay_seconds integer DEFAULT 15,p_retire boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_retire THEN
  DELETE FROM public.interview_media_jobs WHERE round_id=p_round_id AND revision=p_revision AND lease_token=p_lease_token;
  IF FOUND THEN RETURN; END IF;
 END IF;
 UPDATE public.interview_media_jobs SET lease_until=NULL,
 next_attempt_at=CASE WHEN revision=p_revision THEN now()+make_interval(secs=>least(greatest(p_delay_seconds,1),3600)) ELSE now() END
 WHERE round_id=p_round_id AND lease_token=p_lease_token;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_claim_media_job(uuid),public.interview_complete_media_job(uuid,bigint,uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_claim_media_job(uuid),public.interview_complete_media_job(uuid,bigint,uuid,integer,boolean) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('interview-recordings','interview-recordings',false,5242880,ARRAY['audio/webm','audio/mp4','audio/ogg'])
ON CONFLICT(id) DO NOTHING;
-- Upload/download is mediated by authenticated API routes. No direct object policy.

ALTER TABLE public.interview_recordings ADD CONSTRAINT interview_recordings_capture_fk FOREIGN KEY(capture_id) REFERENCES public.interview_media_sessions(id);
CREATE INDEX interview_recordings_capture ON public.interview_recordings(capture_id) WHERE capture_id IS NOT NULL;

-- A capture is a durable attribution anchor. Both capture creation and upload
-- finalisation lock the same round as claimStudent, eliminating correction races.
CREATE FUNCTION public.interview_audio_capture(p_round_id uuid,p_tutor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; d jsonb; progress jsonb; attempt jsonb; capture public.interview_media_sessions; capture_key text; deadline timestamptz; capture_id uuid;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR NOT(p_tutor_id=ANY(r.tutor_ids)) THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501'; END IF;
 d:=public.interview_effective_state(r.data);
 SELECT value INTO progress FROM jsonb_array_elements(d->'progress') WHERE value->>'tutorId'=p_tutor_id::text;
 SELECT value INTO attempt FROM jsonb_array_elements(d->'attempts') WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=progress->>'studentId';
 IF d->>'delivery'<>'in_person' OR NOT coalesce((d->>'recordingEnabled')::boolean,false) OR d->>'pausedAt' IS NOT NULL
  OR attempt IS NULL OR coalesce((progress->>'feedbackComplete')::boolean,false)
  OR NOT (d->>'phase'='questions' AND NOT (progress->>'endedEarly')::boolean OR d->>'mode'='feedback' AND (d->>'phase'='feedback' OR d->>'phase'='questions' AND (progress->>'endedEarly')::boolean)) THEN RETURN NULL; END IF;
 deadline:=CASE WHEN d->>'phase'='questions' THEN (d->>'phaseDeadline')::timestamptz ELSE (d->>'phaseStartedAt')::timestamptz+interval '4 hours' END;
 IF deadline<=now() THEN RETURN NULL; END IF;
 capture_key:='audio:'||r.id||':'||p_tutor_id||':'||(d->>'rotation')||':'||(d->>'phase')||':'||(d->>'phaseStartedAt')||':'||(attempt->>'id');
 SELECT * INTO capture FROM public.interview_media_sessions WHERE phase_key=capture_key;
 IF capture.id IS NULL THEN
  capture_id:=gen_random_uuid();
  INSERT INTO public.interview_media_sessions(id,round_id,attempt_id,tutor_id,kind,phase_key,room_name,expires_at,recording_enabled)
   VALUES(capture_id,r.id,(attempt->>'id')::uuid,p_tutor_id,'audio',capture_key,'audio:'||capture_id,deadline,true) RETURNING * INTO capture;
  INSERT INTO public.interview_recordings(id,round_id,attempt_id,capture_id,provider_id,state,kind)
   VALUES(capture.id,r.id,capture.attempt_id,capture.id,'audio-capture:'||capture.id,'pending','audio');
 END IF;
 RETURN jsonb_build_object('id',capture.id,'attemptId',capture.attempt_id,'expiresAt',capture.expires_at);
END;
$$;

CREATE FUNCTION public.interview_audio_segment(p_round_id uuid,p_tutor_id uuid,p_capture_id uuid,p_segment_id uuid,p_storage_path text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; capture public.interview_media_sessions; segment public.interview_recordings; prefix text;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 SELECT * INTO capture FROM public.interview_media_sessions WHERE id=p_capture_id AND round_id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR capture.id IS NULL OR capture.kind<>'audio' OR capture.tutor_id IS DISTINCT FROM p_tutor_id
  OR NOT(p_tutor_id=ANY(r.tutor_ids)) OR NOT capture.recording_enabled OR capture.created_at+interval '90 days'<=now()
  THEN RAISE EXCEPTION 'Audio capture unavailable' USING ERRCODE='42501'; END IF;
 prefix:=r.id::text||'/'||capture.id::text||'/'||p_segment_id::text;
 IF p_segment_id IS NULL OR p_segment_id=capture.id OR p_storage_path IS NULL
  OR p_storage_path NOT IN (prefix||'.webm',prefix||'.mp4',prefix||'.ogg') THEN RAISE EXCEPTION 'Invalid audio storage path' USING ERRCODE='22023'; END IF;
 SELECT * INTO segment FROM public.interview_recordings WHERE id=p_segment_id;
 IF segment.id IS NOT NULL THEN
  IF segment.capture_id IS DISTINCT FROM capture.id OR segment.storage_path IS DISTINCT FROM p_storage_path THEN RAISE EXCEPTION 'Audio segment identity already used' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',segment.id,'attemptId',segment.attempt_id);
 END IF;
 INSERT INTO public.interview_recordings(id,round_id,attempt_id,capture_id,provider_id,state,kind,storage_path,created_at,expires_at)
 VALUES(p_segment_id,r.id,capture.attempt_id,capture.id,'audio:'||p_segment_id,'ready','audio',p_storage_path,capture.created_at,capture.created_at+interval '90 days');
 RETURN jsonb_build_object('id',p_segment_id,'attemptId',capture.attempt_id);
END;
$$;

CREATE FUNCTION public.interview_move_audio_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='audio' AND NEW.id=NEW.capture_id AND OLD.attempt_id IS DISTINCT FROM NEW.attempt_id THEN
  UPDATE public.interview_media_sessions SET attempt_id=NEW.attempt_id WHERE id=NEW.capture_id AND round_id=NEW.round_id AND kind='audio';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER interview_correct_audio_capture AFTER UPDATE OF attempt_id ON public.interview_recordings
 FOR EACH ROW EXECUTE FUNCTION public.interview_move_audio_capture();
REVOKE ALL ON FUNCTION public.interview_audio_capture(uuid,uuid),public.interview_audio_segment(uuid,uuid,uuid,uuid,text),public.interview_move_audio_capture() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_audio_capture(uuid,uuid),public.interview_audio_segment(uuid,uuid,uuid,uuid,text) TO service_role;
