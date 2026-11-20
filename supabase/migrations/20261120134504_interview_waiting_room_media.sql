-- DEV-484: shared pre-start calls have no station attempt or recording lifetime.
ALTER TABLE public.interview_media_sessions
 ADD COLUMN scope text NOT NULL DEFAULT 'station' CHECK (scope IN ('station','waiting')),
 ALTER COLUMN attempt_id DROP NOT NULL,
 ADD CONSTRAINT interview_media_session_scope CHECK (
  (scope='station' AND attempt_id IS NOT NULL) OR
  (scope='waiting' AND attempt_id IS NULL AND tutor_id IS NULL AND kind='video'
   AND NOT recording_enabled AND NOT recording_active)
 );

-- Starting, editing the roster, or soft-deleting an unstarted round must also
-- wake durable room retirement, even when its phase still says 'waiting'.
CREATE OR REPLACE FUNCTION public.interview_enqueue_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.data->'phase'=NEW.data->'phase'
  AND OLD.data->'phaseStartedAt'=NEW.data->'phaseStartedAt'
  AND OLD.data->'pausedAt' IS NOT DISTINCT FROM NEW.data->'pausedAt'
  AND OLD.data->'progress'=NEW.data->'progress'
  AND OLD.data->'version' IS NOT DISTINCT FROM NEW.data->'version'
  AND OLD.data->'startedAt' IS NOT DISTINCT FROM NEW.data->'startedAt'
  AND OLD.data->'deletedAt' IS NOT DISTINCT FROM NEW.data->'deletedAt'
  THEN RETURN NEW; END IF;
 INSERT INTO public.interview_media_jobs(round_id) VALUES(NEW.id)
 ON CONFLICT(round_id) DO UPDATE SET revision=interview_media_jobs.revision+1,next_attempt_at=now();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_enqueue_media() FROM PUBLIC,anon,authenticated;
