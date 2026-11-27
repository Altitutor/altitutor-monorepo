ALTER TABLE public.messages
  ADD COLUMN scheduled_at timestamptz,
  ADD COLUMN scheduled_dispatch_at timestamptz;
ALTER TABLE public.messages DROP CONSTRAINT messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check CHECK (
  status IN (
    'SCHEDULED', 'CANCELED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ',
    'UNDELIVERED', 'FAILED', 'AMBIGUOUS', 'RECEIVED'
  )
);
ALTER TABLE public.messages ADD CONSTRAINT messages_scheduled_outbound CHECK (
  (status NOT IN ('SCHEDULED', 'CANCELED') OR scheduled_at IS NOT NULL)
  AND (scheduled_at IS NULL OR (direction = 'OUTBOUND' AND NOT is_reaction))
  AND (scheduled_dispatch_at IS NULL OR (scheduled_at IS NOT NULL AND status NOT IN ('SCHEDULED', 'CANCELED')))
);

CREATE INDEX messages_scheduled_due ON public.messages (scheduled_at) WHERE status = 'SCHEDULED';
CREATE INDEX messages_conversation_scheduled ON public.messages (conversation_id, scheduled_at DESC)
  WHERE status = 'SCHEDULED';
CREATE INDEX messages_conversation_scheduled_history
  ON public.messages (conversation_id, scheduled_dispatch_at DESC, id DESC)
  WHERE scheduled_dispatch_at IS NOT NULL;
ALTER TABLE public.conversations ADD COLUMN scheduled_message_at timestamptz;
CREATE INDEX conversations_scheduled_message ON public.conversations (scheduled_message_at DESC NULLS LAST);

CREATE FUNCTION private.refresh_conversation_scheduled_message() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  affected_conversation_ids uuid[];
BEGIN
  affected_conversation_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.conversation_id]
    WHEN 'DELETE' THEN ARRAY[OLD.conversation_id]
    ELSE ARRAY[OLD.conversation_id, NEW.conversation_id]
  END;
  -- Lock both sides of a move in ID order without conflicting with the
  -- foreign-key key-share lock acquired by a concurrent message insert.
  PERFORM 1 FROM public.conversations c
    WHERE c.id = ANY(affected_conversation_ids) ORDER BY c.id FOR NO KEY UPDATE;
  UPDATE public.conversations c
    SET scheduled_message_at = (
      SELECT max(m.scheduled_at)
      FROM public.messages m
      WHERE m.conversation_id = c.id AND m.status = 'SCHEDULED'
    )
    WHERE c.id = ANY(affected_conversation_ids);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.refresh_conversation_scheduled_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER refresh_conversation_scheduled_message_insert
AFTER INSERT ON public.messages FOR EACH ROW WHEN (NEW.status = 'SCHEDULED')
EXECUTE FUNCTION private.refresh_conversation_scheduled_message();

CREATE TRIGGER refresh_conversation_scheduled_message_update
AFTER UPDATE OF status, scheduled_at, conversation_id ON public.messages FOR EACH ROW
WHEN ((OLD.status = 'SCHEDULED' OR NEW.status = 'SCHEDULED')
  AND (OLD.status IS DISTINCT FROM NEW.status
    OR OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
    OR OLD.conversation_id IS DISTINCT FROM NEW.conversation_id))
EXECUTE FUNCTION private.refresh_conversation_scheduled_message();

CREATE TRIGGER refresh_conversation_scheduled_message_delete
AFTER DELETE ON public.messages FOR EACH ROW WHEN (OLD.status = 'SCHEDULED')
EXECUTE FUNCTION private.refresh_conversation_scheduled_message();

CREATE FUNCTION private.capture_scheduled_text_dispatch() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status NOT IN ('SCHEDULED', 'CANCELED') THEN
    NEW.scheduled_dispatch_at := COALESCE(
      NEW.sent_at, NEW.scheduled_dispatch_at, NEW.status_updated_at, clock_timestamp()
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.capture_scheduled_text_dispatch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER capture_scheduled_text_dispatch
BEFORE UPDATE OF status, sent_at ON public.messages FOR EACH ROW
WHEN (NEW.scheduled_at IS NOT NULL)
EXECUTE FUNCTION private.capture_scheduled_text_dispatch();

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  message_at timestamptz :=
    COALESCE(NEW.scheduled_dispatch_at, NEW.sent_at, NEW.received_at, NEW.created_at, now());
BEGIN
  IF NEW.is_reaction OR NEW.status IN ('SCHEDULED', 'CANCELED') THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversations
  SET last_message_at = message_at, last_message_id = NEW.id, last_message_direction = NEW.direction
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR message_at >= last_message_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER trg_messages_set_needs_follow_up ON public.messages;
CREATE TRIGGER trg_messages_set_needs_follow_up
AFTER INSERT ON public.messages FOR EACH ROW WHEN (NEW.status NOT IN ('SCHEDULED', 'CANCELED'))
EXECUTE FUNCTION public.set_conversations_needs_follow_up();

CREATE TRIGGER set_needs_follow_up_on_text_dispatch
AFTER UPDATE OF status ON public.messages FOR EACH ROW
WHEN (OLD.status = 'SCHEDULED' AND NEW.status = 'SENDING')
EXECUTE FUNCTION public.set_conversations_needs_follow_up();

CREATE FUNCTION public.create_scheduled_admin_text(
  p_conversation_id uuid,
  p_body text,
  p_to_number text,
  p_scheduled_at timestamptz,
  p_from_number text DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_resent_from_message_id uuid DEFAULT NULL,
  p_onboarding_journey_id uuid DEFAULT NULL,
  p_onboarding_purpose text DEFAULT NULL,
  p_message_id uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  creator_id uuid;
  message_id uuid;
  existing_status text;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Active ADMINSTAFF required' USING ERRCODE = '42501';
  END IF;
  creator_id := public.current_staff_id();
  IF creator_id IS NULL THEN
    RAISE EXCEPTION 'Staff attribution required' USING ERRCODE = '42501';
  END IF;
  IF p_scheduled_at IS NULL OR NOT isfinite(p_scheduled_at) OR p_scheduled_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Choose a future time to schedule this text.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_attachments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Attachments must be an array.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.messages (
    id, conversation_id, direction, status, body, from_number_e164, to_number_e164,
    scheduled_at, created_by_staff_id, resent_from_message_id, onboarding_journey_id, onboarding_purpose
  ) VALUES (
    p_message_id, p_conversation_id, 'OUTBOUND', 'SCHEDULED', p_body, p_from_number, p_to_number,
    p_scheduled_at, creator_id, p_resent_from_message_id, p_onboarding_journey_id, p_onboarding_purpose
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO message_id;

  IF message_id IS NULL THEN
    SELECT m.status INTO existing_status FROM public.messages m
    WHERE m.id = p_message_id
      AND m.created_by_staff_id = creator_id
      AND m.conversation_id = p_conversation_id
      AND m.scheduled_at = p_scheduled_at
      AND m.body = p_body
      AND m.from_number_e164 IS NOT DISTINCT FROM p_from_number
      AND m.to_number_e164 = p_to_number
      AND m.resent_from_message_id IS NOT DISTINCT FROM p_resent_from_message_id
      AND m.onboarding_journey_id IS NOT DISTINCT FROM p_onboarding_journey_id
      AND m.onboarding_purpose IS NOT DISTINCT FROM p_onboarding_purpose;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The scheduled text ID is already in use.' USING ERRCODE = '23505';
    END IF;
    IF existing_status = 'CANCELED' THEN
      RAISE EXCEPTION 'This scheduled text was already canceled.' USING ERRCODE = '22023';
    END IF;
    RETURN p_message_id;
  END IF;

  INSERT INTO public.message_attachments (message_id, storage_url, filename, mime_type, size_bytes)
  SELECT message_id, entry.storage_url, entry.filename, entry.mime_type, entry.size_bytes
  FROM jsonb_to_recordset(p_attachments) AS entry(storage_url text, filename text, mime_type text, size_bytes bigint);

  RETURN message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_scheduled_admin_text(uuid, text, text, timestamptz, text, jsonb, uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_scheduled_admin_text(uuid, text, text, timestamptz, text, jsonb, uuid, uuid, text, uuid)
  TO authenticated;

-- Repeat the recipient check at connector claim: the Mac may have been offline
-- since the Edge Function queued this command. Its payload must retain the
-- selected address even when a contact also has another messaging address.
CREATE OR REPLACE FUNCTION public.claim_imessage_commands(
  p_connector_id text,
  p_limit integer DEFAULT 10
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_connector_id !~ '^[A-Za-z0-9._-]{1,100}$' THEN
    RAISE EXCEPTION 'Invalid connectorId';
  END IF;
  WITH stale AS (
    UPDATE public.imessage_commands c
    SET status = 'ambiguous', completed_at = now(),
        error = 'Connector claim lease expired; provider acceptance is unknown',
        updated_at = now()
    WHERE c.status = 'claimed'
      AND c.claimed_at < now() - interval '5 minutes'
      AND (
        c.command_type NOT IN ('mark_chat_read', 'mark_chat_unread', 'mark_alerts_read')
        OR c.attempts >= c.max_attempts
      )
    RETURNING c.message_id
  )
  UPDATE public.messages m
  SET status = 'AMBIGUOUS', status_updated_at = now(),
      error_message = 'Connector claim lease expired; provider acceptance is unknown'
  FROM stale
  WHERE m.id = stale.message_id
    AND m.status NOT IN ('SENT', 'DELIVERED', 'READ');

  RETURN QUERY
  WITH claimed AS (
    SELECT cmd.id,
      CASE
        WHEN cmd.command_type <> 'send_message' OR m.scheduled_at IS NULL THEN NULL
        WHEN m.status <> 'SENDING' THEN 'The scheduled message is no longer ready for dispatch.'
        WHEN sender.provider IS DISTINCT FROM 'IMESSAGE'
          OR NOT COALESCE(
            CASE WHEN c.is_group_chat THEN m.to_number_e164 = c.group_chat_id
            ELSE NOT ct.is_opted_out AND (m.to_number_e164 = ct.phone_e164 OR m.to_number_e164 = ct.email)
            END, false
          )
          THEN 'The scheduled recipient changed or opted out. Review the recipient before sending.'
      END AS rejection
    FROM public.imessage_commands cmd
    LEFT JOIN public.messages m ON m.id = cmd.message_id AND cmd.command_type = 'send_message'
    LEFT JOIN public.conversations c ON c.id = m.conversation_id AND m.scheduled_at IS NOT NULL
    LEFT JOIN public.owned_numbers sender ON sender.id = c.owned_number_id
    LEFT JOIN public.contacts ct ON ct.id = c.contact_id
    WHERE (
        cmd.status = 'queued'
        OR (
          cmd.status = 'claimed'
          AND cmd.claimed_at < now() - interval '5 minutes'
          AND cmd.command_type IN ('mark_chat_read', 'mark_chat_unread', 'mark_alerts_read')
        )
      )
      AND cmd.available_at <= now()
      AND cmd.attempts < cmd.max_attempts
      AND (m.scheduled_at IS NULL OR (m.scheduled_at <= now() AND m.status NOT IN ('SCHEDULED', 'CANCELED')))
    ORDER BY cmd.available_at, cmd.created_at
    FOR UPDATE OF cmd SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ), updated AS (
    UPDATE public.imessage_commands c
    SET status = CASE WHEN claimed.rejection IS NULL THEN 'claimed' ELSE 'failed' END,
        claimed_at = CASE WHEN claimed.rejection IS NULL THEN now() ELSE c.claimed_at END,
        claimed_by = CASE WHEN claimed.rejection IS NULL THEN p_connector_id ELSE c.claimed_by END,
        attempts = c.attempts + CASE WHEN claimed.rejection IS NULL THEN 1 ELSE 0 END,
        completed_at = CASE WHEN claimed.rejection IS NULL THEN c.completed_at ELSE now() END,
        error = COALESCE(claimed.rejection, c.error),
        updated_at = now(),
        conversation_id = COALESCE(
          c.conversation_id,
          (SELECT m.conversation_id FROM public.messages m WHERE m.id = c.message_id)
        )
    FROM claimed
    WHERE c.id = claimed.id
    RETURNING c.*, claimed.rejection
  ), tagged AS (
    UPDATE public.messages m
    SET imessage_temp_guid = CASE WHEN u.rejection IS NULL
          THEN COALESCE(m.imessage_temp_guid, u.id::text) ELSE m.imessage_temp_guid END,
        status = CASE
          WHEN u.rejection IS NOT NULL THEN 'FAILED'
          WHEN m.status = 'QUEUED' THEN 'SENDING'
          ELSE m.status
        END,
        error_message = COALESCE(u.rejection, m.error_message),
        status_updated_at = CASE
          WHEN u.rejection IS NOT NULL OR m.status = 'QUEUED' THEN now()
          ELSE m.status_updated_at
        END
    FROM updated u
    WHERE u.command_type = 'send_message'
      AND m.id = u.message_id
      AND (u.rejection IS NULL OR m.status = 'SENDING')
    RETURNING m.id
  )
  SELECT jsonb_build_object(
    'id', u.id,
    'type', u.command_type,
    'payload', jsonb_strip_nulls(
      (u.payload - ARRAY['imessageGuid', 'participant'])
      || jsonb_build_object(
        'text', CASE WHEN u.command_type = 'send_message'
          THEN COALESCE(u.payload->>'text', m.body)
        END,
        'to', CASE WHEN c.is_group_chat IS FALSE THEN recipient.address END,
        'chatId', CASE WHEN c.is_group_chat THEN recipient.address END,
        'chatGuid', CASE
          WHEN c.is_group_chat THEN recipient.address
          WHEN c.id IS NOT NULL AND recipient.address IS NOT NULL
            THEN 'iMessage;-;' || recipient.address
        END,
        'guid', COALESCE(
          u.payload->>'guid',
          u.payload->>'messageGuid',
          u.payload->>'imessageGuid',
          m.imessage_guid
        ),
        'messageGuid', COALESCE(
          u.payload->>'messageGuid',
          u.payload->>'guid',
          u.payload->>'imessageGuid',
          m.imessage_guid
        ),
        'editedMessage', CASE WHEN u.command_type = 'edit_message'
          THEN COALESCE(u.payload->>'editedMessage', u.payload->>'text', m.body)
        END,
        'backwardsCompatibilityMessage', CASE WHEN u.command_type = 'edit_message'
          THEN COALESCE(
            u.payload->>'backwardsCompatibilityMessage',
            u.payload->>'editedMessage',
            u.payload->>'text',
            m.body
          )
        END,
        'address', COALESCE(u.payload->>'address', u.payload->>'participant'),
        'replyToGuid', COALESCE(
          u.payload->>'replyToGuid',
          u.payload->>'replyToMessageGuid'
        ),
        'mediaUrls', CASE WHEN u.command_type = 'send_message' THEN COALESCE((
          SELECT jsonb_agg(a.storage_url ORDER BY a.created_at, a.id)
          FROM public.message_attachments a
          WHERE a.message_id = m.id
        ), '[]'::jsonb) END,
        'tempGuid', CASE WHEN u.command_type = 'send_message' THEN u.id::text END,
        'correlation', CASE WHEN u.command_type = 'send_message' THEN u.id::text END
      )
    ),
    'attempts', u.attempts
  )
  FROM updated u
  LEFT JOIN public.messages m ON m.id = u.message_id
  LEFT JOIN public.conversations c ON c.id = CASE
    WHEN u.command_type = 'send_message' AND m.scheduled_at IS NOT NULL THEN m.conversation_id
    ELSE COALESCE(u.conversation_id, m.conversation_id)
  END
  LEFT JOIN public.contacts ct ON ct.id = c.contact_id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN u.command_type = 'send_message' AND m.scheduled_at IS NOT NULL THEN m.to_number_e164
      WHEN c.is_group_chat THEN c.group_chat_id
      ELSE COALESCE(ct.phone_e164, ct.email)
    END AS address
  ) recipient
  WHERE u.rejection IS NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping text send scheduler: pg_cron or pg_net unavailable.';
    RETURN;
  END IF;
  PERFORM cron.schedule('dispatch-scheduled-admin-texts', '* * * * *', $cron$
    UPDATE public.messages AS m
    SET status = 'AMBIGUOUS', error_message = 'The scheduled send outcome could not be confirmed.'
    WHERE m.scheduled_at IS NOT NULL AND m.status = 'SENDING'
      AND m.sent_at IS NULL AND m.status_updated_at < now() - interval '15 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.imessage_commands c WHERE c.message_id = m.id);

    SELECT net.http_post(
      url := config.url || '/functions/v1/send-message',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || config.service_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('messageId', due.id),
      timeout_milliseconds := 60000
    )
    FROM (
      SELECT id FROM public.messages
      WHERE status = 'SCHEDULED' AND scheduled_at <= now()
      ORDER BY scheduled_at
      LIMIT 50
    ) due
    CROSS JOIN LATERAL (SELECT public.get_supabase_url() AS url, public.get_service_role_key() AS service_key) config
    WHERE config.url IS NOT NULL AND config.service_key IS NOT NULL;
  $cron$);
END;
$$;
