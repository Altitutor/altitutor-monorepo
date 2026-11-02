-- Scheduled mail shares the existing duplicate-safe send registry. A claimed
-- delivery is never automatically retried after an uncertain provider outcome.
ALTER TABLE public.email_send_attempts ADD COLUMN scheduled_at timestamptz,
 ADD COLUMN change_key text;
ALTER TABLE public.email_send_attempts DROP CONSTRAINT email_send_attempts_state_check;
ALTER TABLE public.email_send_attempts ADD CONSTRAINT email_send_attempts_state_check
 CHECK(state IN ('scheduled','paused','sending','submitted','uncertain','sent','failed'));
CREATE INDEX email_send_attempts_due ON public.email_send_attempts(scheduled_at) WHERE state='scheduled';

CREATE FUNCTION public.email_schedule_send(p_message_id text,p_change_key text,p_staff_id uuid,p_command_id uuid,p_scheduled_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_claim jsonb;
BEGIN
 IF p_scheduled_at IS NULL OR p_scheduled_at <= now() OR p_scheduled_at > now()+interval '1 year' THEN
   RAISE EXCEPTION 'Choose a future send time within one year';
 END IF;
 -- The same message row/lease checks as Send and Save serialize portal editors.
 v_claim := public.email_begin_send(p_message_id,p_change_key,p_staff_id,p_command_id);
 IF NOT coalesce((v_claim->>'proceed')::boolean,false) THEN RETURN v_claim; END IF;
 UPDATE public.email_send_attempts SET state='scheduled',scheduled_at=p_scheduled_at,change_key=p_change_key,updated_at=now()
 WHERE command_id=p_command_id;
 RETURN jsonb_build_object('state','scheduled');
END;
$$;
REVOKE ALL ON FUNCTION public.email_schedule_send(text,text,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_schedule_send(text,text,uuid,uuid,timestamptz) TO service_role;

CREATE FUNCTION public.email_claim_scheduled_sends()
RETURNS SETOF public.email_send_attempts LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE public.email_send_attempts SET state='sending',updated_at=now()
 WHERE command_id IN (
   SELECT command_id FROM public.email_send_attempts WHERE state='scheduled' AND scheduled_at<=now()
   ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 1
 ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.email_claim_scheduled_sends() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_claim_scheduled_sends() TO service_role;

CREATE FUNCTION public.email_cancel_schedule(p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 -- DELETE only unclaimed reservations, atomically racing the due-job UPDATE.
 -- A sending/uncertain attempt remains immutable and cannot be cancelled/retried.
 DELETE FROM public.email_send_attempts WHERE command_id=p_command_id AND state IN ('scheduled','paused');
 IF FOUND THEN RETURN jsonb_build_object('state','cancelled'); END IF;
 RETURN jsonb_build_object('state','busy');
END;
$$;
REVOKE ALL ON FUNCTION public.email_cancel_schedule(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_cancel_schedule(uuid) TO service_role;
