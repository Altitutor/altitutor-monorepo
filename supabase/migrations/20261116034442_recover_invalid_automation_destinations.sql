-- Provider rejections are terminal for automated deliveries, not customer opt-outs.
ALTER TABLE public.automation_message_deliveries
  ADD COLUMN terminal_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN recipient_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN recipient_parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  ADD COLUMN recovery_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
CREATE INDEX automation_deliveries_recovery_message_idx
  ON public.automation_message_deliveries(recovery_message_id) WHERE recovery_message_id IS NOT NULL;

CREATE TABLE public.automation_destination_blocks (
  owned_number_id uuid NOT NULL REFERENCES public.owned_numbers(id) ON DELETE CASCADE,
  destination text NOT NULL,
  failed_message_id uuid NOT NULL REFERENCES public.messages(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owned_number_id, destination)
);
ALTER TABLE public.automation_destination_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_destination_blocks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_destination_blocks TO service_role;
GRANT SELECT ON public.automation_destination_blocks TO authenticated;
CREATE POLICY "Active admins read automated destination failures"
  ON public.automation_destination_blocks FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

-- Retain every recovery's membership even when a later attempt supersedes it.
CREATE TABLE public.automation_message_recovery_attempts (
  message_id uuid PRIMARY KEY REFERENCES public.messages(id),
  delivery_id uuid REFERENCES public.automation_message_deliveries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_recovery_attempts_delivery_idx ON public.automation_message_recovery_attempts(delivery_id);
ALTER TABLE public.automation_message_recovery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_message_recovery_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.automation_message_recovery_attempts TO service_role;
GRANT SELECT ON public.automation_message_recovery_attempts TO authenticated;
CREATE POLICY "Active admins read automation recovery attempts"
ON public.automation_message_recovery_attempts FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION private.snapshot_automation_recipient() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  SELECT student_id, parent_id INTO NEW.recipient_student_id, NEW.recipient_parent_id
  FROM public.contacts WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.snapshot_automation_recipient() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER snapshot_automation_recipient BEFORE INSERT ON public.automation_message_deliveries
FOR EACH ROW EXECUTE FUNCTION private.snapshot_automation_recipient();

CREATE FUNCTION private.track_automation_destination_failure() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d public.automation_message_deliveries%ROWTYPE;
  sender_id uuid;
  original_contact uuid;
  notice_resolved boolean;
BEGIN
  IF NEW.direction <> 'OUTBOUND' OR NEW.is_historical_import THEN RETURN NEW; END IF;
  SELECT * INTO d FROM public.automation_message_deliveries
  WHERE message_id=NEW.id OR recovery_message_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.status IN ('FAILED','UNDELIVERED') AND NEW.error_code=21211 THEN
    SELECT owned_number_id INTO sender_id FROM public.conversations WHERE id=NEW.conversation_id;
    INSERT INTO public.automation_destination_blocks(owned_number_id,destination,failed_message_id)
    VALUES (sender_id,NEW.to_number_e164,NEW.id) ON CONFLICT DO NOTHING;
    UPDATE public.automation_message_deliveries
      SET terminal_failure=true,status='FAILED',last_error='Destination rejected (21211); staff recovery required'
      WHERE id=d.id;
    d.terminal_failure := true;
  END IF;
  IF NOT d.terminal_failure THEN RETURN NEW; END IF;

  -- A sending claim is not provider acceptance: require its SID as well.
  notice_resolved := NEW.id=d.recovery_message_id AND NEW.message_sid IS NOT NULL
    AND NEW.status IN ('QUEUED','SENDING','SENT','DELIVERED');
  IF NEW.id=d.message_id AND d.recovery_message_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.contact_id INTO original_contact FROM public.messages m
    JOIN public.conversations c ON c.id=m.conversation_id WHERE m.id=d.message_id;
  INSERT INTO public.notifications(staff_id,app_scope,notification_type,title,body,action_url,dedupe_key,priority,metadata,resolved_at)
  SELECT s.id,'staff_web','AUTOMATION_DESTINATION_FAILED','Automated message needs attention',
    'Review the failed message and correct the recipient details before explicitly sending it again.',
    '/messages?contact=' || original_contact || '&message=' || d.message_id,
    'automation:destination-failed:' || d.id || ':' || s.id,'important',
    jsonb_build_object('message_id',d.message_id,'delivery_id',d.id),
    CASE WHEN notice_resolved THEN now() ELSE NULL END
  FROM public.staff s WHERE s.role='ADMINSTAFF' AND s.status='ACTIVE'
  ON CONFLICT (dedupe_key) DO UPDATE SET
    resolved_at=EXCLUDED.resolved_at,
    read_at=CASE WHEN EXCLUDED.resolved_at IS NULL AND notifications.resolved_at IS NOT NULL THEN NULL ELSE notifications.read_at END,
    dismissed_at=CASE WHEN EXCLUDED.resolved_at IS NULL THEN NULL ELSE notifications.dismissed_at END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.track_automation_destination_failure() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER track_automation_destination_failure
AFTER UPDATE OF status,error_code,message_sid ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.track_automation_destination_failure();

-- Service-only APIs: the authenticated AdminStaff route supplies the actor.
CREATE OR REPLACE FUNCTION public.preview_automation_message_recovery(p_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d public.automation_message_deliveries%ROWTYPE;
  m public.messages%ROWTYPE;
  c public.contacts%ROWTYPE;
  sender public.owned_numbers%ROWTYPE;
  latest public.messages%ROWTYPE;
  reason text;
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.automation_message_deliveries WHERE message_id=p_message_id AND terminal_failure;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terminal automated delivery not found'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  SELECT n.* INTO sender FROM public.conversations cv JOIN public.owned_numbers n ON n.id=cv.owned_number_id WHERE cv.id=m.conversation_id;
  IF d.recipient_student_id IS NOT NULL THEN
    SELECT ct.* INTO c FROM public.contacts ct JOIN public.students s ON s.id=ct.student_id
      WHERE s.id=d.recipient_student_id AND s.deleted_at IS NULL;
  ELSIF d.recipient_parent_id IS NOT NULL THEN
    SELECT ct.* INTO c FROM public.contacts ct JOIN public.parents p ON p.id=ct.parent_id
      WHERE p.id=d.recipient_parent_id AND p.deleted_at IS NULL;
  ELSE
    SELECT * INTO c FROM public.contacts WHERE id=d.contact_id AND student_id IS NULL AND parent_id IS NULL;
  END IF;
  SELECT * INTO latest FROM public.messages WHERE id=d.recovery_message_id;
  IF c.id IS NULL OR c.phone_e164 IS NULL THEN reason := 'A current recipient phone number is required.';
  ELSIF c.is_opted_out THEN reason := 'This recipient has opted out of messages.';
  ELSIF c.phone_e164=m.to_number_e164 THEN reason := 'Correct the phone number in the person’s details before sending.';
  ELSIF EXISTS (SELECT 1 FROM public.automation_destination_blocks b WHERE b.owned_number_id=sender.id AND b.destination=c.phone_e164) THEN reason := 'This sender has already rejected the current number. Correct the recipient details.';
  ELSIF latest.status='AMBIGUOUS' THEN reason := 'The send outcome is unconfirmed. Reconcile the provider outcome before sending again.';
  ELSIF latest.id IS NOT NULL AND latest.status NOT IN ('FAILED','UNDELIVERED') THEN reason := 'A recovery is already queued or accepted. Check its outcome before sending again.';
  END IF;
  RETURN jsonb_build_object('messageId',m.id,'body',m.body,'originalDestination',m.to_number_e164,
    'originalCreatedAt',m.created_at,'senderId',sender.id,'senderLabel',COALESCE(sender.label,sender.alphanumeric_sender_id,sender.phone_e164),
    'contactId',c.id,'destination',c.phone_e164,'recipientName',COALESCE((SELECT concat_ws(' ',first_name,last_name) FROM public.students WHERE id=c.student_id),(SELECT concat_ws(' ',first_name,last_name) FROM public.parents WHERE id=c.parent_id),c.phone_e164,'Recipient'),
    'recoveryMessageId',d.recovery_message_id,'recoveryStatus',latest.status,'canSend',reason IS NULL,'reason',reason);
END;
$$;
REVOKE ALL ON FUNCTION public.preview_automation_message_recovery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_automation_message_recovery(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_automation_message_recovery(
  p_message_id uuid,p_staff_id uuid,p_contact_id uuid,p_destination text,p_expected_recovery_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d public.automation_message_deliveries%ROWTYPE;
  preview jsonb;
  conversation_id uuid;
  new_message_id uuid;
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff WHERE id=p_staff_id AND role='ADMINSTAFF' AND status='ACTIVE') THEN
    RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.automation_message_deliveries WHERE message_id=p_message_id AND terminal_failure FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Terminal automated delivery not found'; END IF;
  -- A stale double-submit returns the one reserved recovery, never another send.
  IF d.recovery_message_id IS DISTINCT FROM p_expected_recovery_id THEN
    RETURN jsonb_build_object('messageId',d.recovery_message_id,'created',false);
  END IF;
  preview := public.preview_automation_message_recovery(p_message_id);
  IF preview->>'canSend' <> 'true' THEN RAISE EXCEPTION '%',preview->>'reason'; END IF;
  IF (preview->>'contactId')::uuid IS DISTINCT FROM p_contact_id OR preview->>'destination' IS DISTINCT FROM p_destination THEN
    RAISE EXCEPTION 'Recipient changed. Review the current details before sending.';
  END IF;
  -- Serialize creation with ordinary conversation creators using the unique key.
  SELECT id INTO conversation_id FROM public.conversations
    WHERE contact_id=p_contact_id AND owned_number_id=(preview->>'senderId')::uuid AND status IN ('OPEN','SNOOZED') LIMIT 1;
  IF conversation_id IS NULL THEN
    BEGIN
      INSERT INTO public.conversations(contact_id,owned_number_id,status)
      VALUES (p_contact_id,(preview->>'senderId')::uuid,'OPEN') RETURNING id INTO conversation_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO conversation_id FROM public.conversations
        WHERE contact_id=p_contact_id AND owned_number_id=(preview->>'senderId')::uuid AND status IN ('OPEN','SNOOZED') LIMIT 1;
      IF conversation_id IS NULL THEN RAISE; END IF;
    END;
  END IF;
  INSERT INTO public.messages(conversation_id,direction,body,to_number_e164,status,created_by_staff_id,resent_from_message_id)
  VALUES (conversation_id,'OUTBOUND',preview->>'body',p_destination,'QUEUED',p_staff_id,p_message_id) RETURNING id INTO new_message_id;
  INSERT INTO public.automation_message_recovery_attempts(message_id,delivery_id) VALUES (new_message_id,d.id);
  UPDATE public.automation_message_deliveries SET recovery_message_id=new_message_id WHERE id=d.id;
  RETURN jsonb_build_object('messageId',new_message_id,'created',true);
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_automation_message_recovery(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_automation_message_recovery(uuid,uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_automation_message_send(p_message_id uuid,p_destination text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d public.automation_message_deliveries%ROWTYPE;
  m public.messages%ROWTYPE;
  sender_id uuid;
  preview jsonb;
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.automation_message_deliveries d0
    WHERE d0.message_id=p_message_id OR EXISTS(SELECT 1 FROM public.automation_message_recovery_attempts a WHERE a.message_id=p_message_id AND a.delivery_id=d0.id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('dispatch',NOT EXISTS(SELECT 1 FROM public.automation_message_recovery_attempts WHERE message_id=p_message_id));
  END IF;
  -- All message UPDATE triggers lock message then delivery. Match that order.
  SELECT * INTO m FROM public.messages WHERE id=p_message_id FOR UPDATE;
  SELECT * INTO d FROM public.automation_message_deliveries WHERE id=d.id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('dispatch',false); END IF;
  IF p_message_id <> d.message_id AND p_message_id IS DISTINCT FROM d.recovery_message_id THEN
    RETURN jsonb_build_object('dispatch',false);
  END IF;
  SELECT owned_number_id INTO sender_id FROM public.conversations WHERE id=m.conversation_id;
  IF d.recovery_message_id=p_message_id AND m.status <> 'QUEUED' THEN
    RETURN jsonb_build_object('dispatch',false);
  ELSIF d.message_id=p_message_id AND d.terminal_failure THEN
    RETURN jsonb_build_object('dispatch',false);
  END IF;
  IF EXISTS(SELECT 1 FROM public.automation_destination_blocks WHERE owned_number_id=sender_id AND destination=p_destination) THEN
    RETURN jsonb_build_object('dispatch',false,'blocked',true);
  END IF;
  IF d.recovery_message_id=p_message_id THEN
    IF m.status <> 'QUEUED' THEN RETURN jsonb_build_object('dispatch',false); END IF;
    preview := public.preview_automation_message_recovery(d.message_id);
    IF preview->>'destination' IS DISTINCT FROM p_destination OR m.to_number_e164 IS DISTINCT FROM p_destination
      OR (preview->>'contactId')::uuid IS DISTINCT FROM (SELECT contact_id FROM public.conversations WHERE id=m.conversation_id)
      OR EXISTS(SELECT 1 FROM public.contacts WHERE id=(preview->>'contactId')::uuid AND is_opted_out) THEN
      RAISE EXCEPTION 'Recipient changed. Review the current details before sending.';
    END IF;
    -- Once a dispatch is claimed, a lost response must never blindly resend it.
    UPDATE public.messages SET status='SENDING' WHERE id=p_message_id;
  ELSIF d.terminal_failure THEN RETURN jsonb_build_object('dispatch',false);
  END IF;
  RETURN jsonb_build_object('dispatch',true,'recovery',d.recovery_message_id=p_message_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_automation_message_send(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_message_send(uuid,text) TO service_role;

-- Delayed acceptance callbacks cannot erase a terminal recovery failure.
CREATE FUNCTION private.preserve_recovery_provider_outcome() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.automation_message_recovery_attempts WHERE message_id=OLD.id)
    AND ((OLD.status IN ('FAILED','UNDELIVERED') AND NEW.status NOT IN ('FAILED','UNDELIVERED'))
      OR (OLD.status='DELIVERED' AND NEW.status <> 'DELIVERED')) THEN
    NEW.status := OLD.status;
    NEW.error_code := OLD.error_code;
    NEW.error_message := OLD.error_message;
    NEW.status_updated_at := OLD.status_updated_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.preserve_recovery_provider_outcome() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_recovery_provider_outcome BEFORE UPDATE OF status ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.preserve_recovery_provider_outcome();
