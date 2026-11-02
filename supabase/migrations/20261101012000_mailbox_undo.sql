-- Undo receipts are private, short lived and single use. Responsibility versions
-- include sync-driven changes, so undo cannot overwrite a reply or an ABA edit.
CREATE TABLE public.email_command_undos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 staff_id uuid NOT NULL REFERENCES public.staff(id),
 payload jsonb NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes'
);
ALTER TABLE public.email_command_undos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_command_undos FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_command_undos TO service_role;
ALTER TABLE public.email_threads ADD COLUMN responsibility_version bigint NOT NULL DEFAULT 0;
CREATE FUNCTION public.email_responsibility_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.assigned_staff_id IS DISTINCT FROM OLD.assigned_staff_id OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
  NEW.responsibility_version := OLD.responsibility_version+1;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.email_responsibility_version() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_responsibility_version() TO service_role;
CREATE TRIGGER email_responsibility_version BEFORE UPDATE ON public.email_threads
 FOR EACH ROW EXECUTE FUNCTION public.email_responsibility_version();

CREATE FUNCTION public.email_assign_with_undo(p_thread_id text,p_staff_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_before public.email_threads; v_after public.email_threads; v_id uuid; v_detail jsonb;
BEGIN
 SELECT * INTO STRICT v_before FROM public.email_threads WHERE id=p_thread_id FOR UPDATE;
 v_detail := public.email_assign_thread(p_thread_id,p_staff_id);
 IF v_before.assigned_staff_id IS NOT DISTINCT FROM p_staff_id THEN RETURN v_detail; END IF;
 SELECT * INTO STRICT v_after FROM public.email_threads WHERE id=p_thread_id;
 DELETE FROM public.email_command_undos WHERE expires_at<now();
 INSERT INTO public.email_command_undos(staff_id,payload) VALUES(p_actor_id,
  jsonb_build_object('kind','assignment','threadId',p_thread_id,'staffId',v_before.assigned_staff_id,
   'assignedAt',v_before.assigned_at,'version',v_after.responsibility_version)) RETURNING id INTO v_id;
 RETURN v_detail || jsonb_build_object('undoIds',jsonb_build_array(v_id));
END;
$$;
CREATE FUNCTION public.email_undo_assignment(p_thread_id text,p_staff_id uuid,p_assigned_at timestamptz,p_version bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_current public.email_threads;
BEGIN
 SELECT * INTO STRICT v_current FROM public.email_threads WHERE id=p_thread_id FOR UPDATE;
 IF v_current.responsibility_version<>p_version THEN RAISE EXCEPTION 'Responsibility changed since this action; it was not overwritten'; END IF;
 PERFORM public.email_assign_thread(p_thread_id,p_staff_id);
 -- Restore the original responsibility interval, not a new interval beginning now.
 UPDATE public.email_threads SET assigned_at=p_assigned_at WHERE id=p_thread_id;
END;
$$;
CREATE FUNCTION public.email_claim_scheduled_send(p_command_id uuid)
RETURNS SETOF public.email_send_attempts LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE public.email_send_attempts SET state='sending',updated_at=now()
 WHERE command_id IN (SELECT command_id FROM public.email_send_attempts
  WHERE command_id=p_command_id AND state='scheduled' AND scheduled_at<=now()
  FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.email_assign_with_undo(text,uuid,uuid),public.email_undo_assignment(text,uuid,timestamptz,bigint),public.email_claim_scheduled_send(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_assign_with_undo(text,uuid,uuid),public.email_undo_assignment(text,uuid,timestamptz,bigint),public.email_claim_scheduled_send(uuid) TO service_role;

-- Cancellation returns an editable draft, including when its old editor closed
-- after queue acceptance. Release only the reservation author's idle lease.
CREATE OR REPLACE FUNCTION public.email_cancel_schedule(p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_attempt public.email_send_attempts;
BEGIN
 DELETE FROM public.email_send_attempts WHERE command_id=p_command_id AND state IN ('scheduled','paused')
 RETURNING * INTO v_attempt;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','busy'); END IF;
 DELETE FROM public.email_draft_edits WHERE message_id=v_attempt.message_id
  AND staff_id=v_attempt.staff_id AND (writing_until IS NULL OR writing_until<=now());
 RETURN jsonb_build_object('state','cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.email_cancel_schedule(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_cancel_schedule(uuid) TO service_role;
