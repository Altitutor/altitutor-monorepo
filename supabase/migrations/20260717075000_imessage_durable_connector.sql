-- Durable Supabase-canonical iMessage command ledger and event inbox.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS imessage_temp_guid text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_error_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_imessage_temp_guid
  ON public.messages(imessage_temp_guid)
  WHERE imessage_temp_guid IS NOT NULL;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check CHECK (
  status IN (
    'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'UNDELIVERED',
    'FAILED', 'AMBIGUOUS', 'RECEIVED'
  )
);

CREATE TABLE public.imessage_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type text NOT NULL CHECK (command_type IN (
    'send_message', 'edit_message', 'unsend_message', 'react',
    'mark_chat_read', 'mark_chat_unread', 'create_chat', 'update_chat',
    'delete_chat', 'leave_chat', 'add_participant', 'remove_participant',
    'set_group_icon', 'remove_group_icon', 'delete_message',
    'restart_messages_app', 'mark_alerts_read'
  )),
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'claimed', 'succeeded', 'failed', 'ambiguous', 'cancelled')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  completed_at timestamptz,
  result jsonb,
  error text,
  idempotency_key text NOT NULL UNIQUE,
  requested_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  reason text,
  destructive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (destructive = (command_type IN (
    'unsend_message', 'delete_chat', 'leave_chat', 'remove_participant',
    'remove_group_icon', 'delete_message', 'restart_messages_app'
  ))),
  CHECK (
    NOT destructive
    OR (
      NULLIF(btrim(reason), '') IS NOT NULL
      AND requested_by_staff_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_imessage_commands_claim
  ON public.imessage_commands(available_at, created_at)
  WHERE status = 'queued';
CREATE INDEX idx_imessage_commands_message_id ON public.imessage_commands(message_id);
CREATE INDEX idx_imessage_commands_conversation_id ON public.imessage_commands(conversation_id);

CREATE TABLE public.imessage_connector_state (
  connector_id text PRIMARY KEY CHECK (connector_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  status text NOT NULL DEFAULT 'unknown' CHECK (
    status IN ('unknown', 'healthy', 'degraded', 'offline', 'paused')
  ),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  app_version text,
  host_label text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.imessage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  connector_id text,
  imessage_guid text,
  temp_guid text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  processing_attempts integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_imessage_events_unprocessed
  ON public.imessage_events(received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.imessage_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imessage_connector_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imessage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF read imessage commands"
  ON public.imessage_commands FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF read connector state"
  ON public.imessage_connector_state FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF read imessage events"
  ON public.imessage_events FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

REVOKE ALL ON public.imessage_commands FROM anon, authenticated;
REVOKE ALL ON public.imessage_connector_state FROM anon, authenticated;
REVOKE ALL ON public.imessage_events FROM anon, authenticated;
GRANT SELECT ON public.imessage_commands TO authenticated;
GRANT SELECT ON public.imessage_connector_state TO authenticated;
GRANT SELECT ON public.imessage_events TO authenticated;

CREATE OR REPLACE FUNCTION public.imessage_is_destructive(p_command_type text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_command_type IN (
    'unsend_message', 'delete_chat', 'leave_chat', 'remove_participant',
    'remove_group_icon', 'delete_message', 'restart_messages_app'
  )
$$;

CREATE OR REPLACE FUNCTION public.imessage_validate_command(
  p_command_type text,
  p_message_id uuid,
  p_conversation_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_command_type NOT IN (
    'send_message', 'edit_message', 'unsend_message', 'react',
    'mark_chat_read', 'mark_chat_unread', 'create_chat', 'update_chat',
    'delete_chat', 'leave_chat', 'add_participant', 'remove_participant',
    'set_group_icon', 'remove_group_icon', 'delete_message',
    'restart_messages_app', 'mark_alerts_read'
  ) THEN
    RAISE EXCEPTION 'Unsupported iMessage command';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be an object';
  END IF;
  IF p_command_type IN ('send_message', 'edit_message', 'unsend_message', 'delete_message')
     AND p_message_id IS NULL THEN
    RAISE EXCEPTION 'messageId is required for %', p_command_type;
  END IF;
  IF p_command_type IN (
    'mark_chat_read', 'mark_chat_unread', 'update_chat', 'delete_chat',
    'leave_chat', 'add_participant', 'remove_participant',
    'set_group_icon', 'remove_group_icon'
  ) AND p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'conversationId is required for %', p_command_type;
  END IF;
  IF p_command_type = 'react'
     AND (p_message_id IS NULL OR NULLIF(p_payload->>'reaction', '') IS NULL) THEN
    RAISE EXCEPTION 'react requires messageId and payload.reaction';
  END IF;
  IF p_command_type IN ('add_participant', 'remove_participant')
     AND NULLIF(p_payload->>'participant', '') IS NULL THEN
    RAISE EXCEPTION '% requires payload.participant', p_command_type;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_imessage_command(
  p_command_type text,
  p_message_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.imessage_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id uuid;
  v_destructive boolean;
  v_key text;
  v_command public.imessage_commands;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Active ADMINSTAFF required' USING ERRCODE = '42501';
  END IF;
  v_staff_id := public.current_staff_id();
  v_destructive := public.imessage_is_destructive(p_command_type);
  IF v_destructive AND NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for destructive commands';
  END IF;
  PERFORM public.imessage_validate_command(
    p_command_type, p_message_id, p_conversation_id, COALESCE(p_payload, '{}'::jsonb)
  );
  v_key := COALESCE(
    NULLIF(p_idempotency_key, ''),
    'admin:' || v_staff_id::text || ':' || gen_random_uuid()::text
  );
  INSERT INTO public.imessage_commands (
    command_type, message_id, conversation_id, payload, idempotency_key,
    requested_by_staff_id, reason, destructive
  ) VALUES (
    p_command_type, p_message_id, p_conversation_id, COALESCE(p_payload, '{}'::jsonb),
    v_key, v_staff_id, NULLIF(btrim(p_reason), ''), v_destructive
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING * INTO v_command;
  RETURN v_command;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_imessage_send_command(p_message_id uuid)
RETURNS public.imessage_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message public.messages;
  v_provider text;
  v_command public.imessage_commands;
BEGIN
  SELECT m.* INTO v_message
  FROM public.messages m
  WHERE m.id = p_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  SELECT onum.provider INTO v_provider
  FROM public.conversations c
  JOIN public.owned_numbers onum ON onum.id = c.owned_number_id
  WHERE c.id = v_message.conversation_id;
  IF v_provider IS DISTINCT FROM 'IMESSAGE' THEN
    RAISE EXCEPTION 'Message is not routed to iMessage';
  END IF;
  IF v_message.direction <> 'OUTBOUND' THEN
    RAISE EXCEPTION 'Only outbound messages can be queued';
  END IF;
  INSERT INTO public.imessage_commands (
    command_type, message_id, conversation_id, payload, idempotency_key
  ) VALUES (
    'send_message', v_message.id, v_message.conversation_id, '{}'::jsonb,
    'send:' || v_message.id::text
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING * INTO v_command;
  RETURN v_command;
END;
$$;

CREATE OR REPLACE FUNCTION public.imessage_queue_outbound_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_provider text;
BEGIN
  IF NEW.direction = 'OUTBOUND' AND NEW.status = 'QUEUED' THEN
    SELECT onum.provider INTO v_provider
    FROM public.conversations c
    JOIN public.owned_numbers onum ON onum.id = c.owned_number_id
    WHERE c.id = NEW.conversation_id;
    IF v_provider = 'IMESSAGE' THEN
      PERFORM public.ensure_imessage_send_command(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_imessage_outbound_command ON public.messages;
CREATE TRIGGER queue_imessage_outbound_command
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.imessage_queue_outbound_trigger();

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
    SELECT c.id
    FROM public.imessage_commands c
    WHERE (
        c.status = 'queued'
        OR (
          c.status = 'claimed'
          AND c.claimed_at < now() - interval '5 minutes'
          AND c.command_type IN ('mark_chat_read', 'mark_chat_unread', 'mark_alerts_read')
        )
      )
      AND c.available_at <= now()
      AND c.attempts < c.max_attempts
    ORDER BY c.available_at, c.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ), updated AS (
    UPDATE public.imessage_commands c
    SET status = 'claimed', claimed_at = now(), claimed_by = p_connector_id,
        attempts = c.attempts + 1, updated_at = now()
    FROM claimed
    WHERE c.id = claimed.id
    RETURNING c.*
  ), tagged AS (
    UPDATE public.messages m
    SET imessage_temp_guid = COALESCE(m.imessage_temp_guid, u.id::text),
        status = CASE WHEN m.status = 'QUEUED' THEN 'SENDING' ELSE m.status END,
        status_updated_at = CASE WHEN m.status = 'QUEUED' THEN now() ELSE m.status_updated_at END
    FROM updated u
    WHERE u.command_type = 'send_message'
      AND m.id = u.message_id
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
        'to', CASE WHEN c.is_group_chat IS FALSE
          THEN COALESCE(ct.phone_e164, ct.email)
        END,
        'chatId', CASE WHEN c.is_group_chat
          THEN c.group_chat_id
        END,
        'chatGuid', CASE
          WHEN c.is_group_chat THEN c.group_chat_id
          WHEN c.id IS NOT NULL AND COALESCE(ct.phone_e164, ct.email) IS NOT NULL
            THEN 'iMessage;-;' || COALESCE(ct.phone_e164, ct.email)
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
  LEFT JOIN public.conversations c ON c.id = u.conversation_id
  LEFT JOIN public.contacts ct ON ct.id = c.contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_imessage_command(
  p_command_id uuid,
  p_connector_id text,
  p_status text,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS public.imessage_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_command public.imessage_commands;
  v_provider_accepted boolean;
  v_retryable boolean;
  v_delay_seconds integer;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('succeeded', 'failed', 'ambiguous', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid completion status';
  END IF;
  SELECT * INTO v_command
  FROM public.imessage_commands
  WHERE id = p_command_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Command not found'; END IF;
  IF v_command.status IN ('succeeded', 'ambiguous', 'cancelled') THEN
    RETURN v_command;
  END IF;
  IF v_command.status <> 'claimed' OR v_command.claimed_by IS DISTINCT FROM p_connector_id THEN
    RAISE EXCEPTION 'Command is not claimed by connector';
  END IF;

  v_provider_accepted := CASE p_result->>'providerAccepted'
    WHEN 'true' THEN true
    WHEN 'false' THEN false
    ELSE false
  END;
  v_retryable := CASE p_result->>'retryable'
    WHEN 'true' THEN true
    WHEN 'false' THEN false
    ELSE false
  END;
  IF p_status = 'failed'
     AND v_retryable
     AND NOT v_provider_accepted
     AND v_command.command_type IN ('mark_chat_read', 'mark_chat_unread', 'mark_alerts_read')
     AND v_command.attempts < v_command.max_attempts THEN
    v_delay_seconds := LEAST(900, 5 * power(2, GREATEST(v_command.attempts - 1, 0))::integer);
    UPDATE public.imessage_commands
    SET status = 'queued', available_at = now() + make_interval(secs => v_delay_seconds),
        claimed_at = NULL, claimed_by = NULL, result = p_result, error = p_error,
        updated_at = now()
    WHERE id = p_command_id
    RETURNING * INTO v_command;
    RETURN v_command;
  END IF;

  UPDATE public.imessage_commands
  SET status = p_status, completed_at = now(), result = COALESCE(p_result, '{}'::jsonb),
      error = p_error, updated_at = now()
  WHERE id = p_command_id
  RETURNING * INTO v_command;

  IF v_command.command_type = 'send_message' AND v_command.message_id IS NOT NULL THEN
    IF p_status = 'succeeded' THEN
      UPDATE public.messages
      SET imessage_guid = COALESCE(NULLIF(p_result->>'guid', ''), imessage_guid),
          imessage_temp_guid = COALESCE(NULLIF(p_result->>'tempGuid', ''), imessage_temp_guid, v_command.id::text),
          message_sid = COALESCE(NULLIF(p_result->>'messageId', ''), message_sid),
          status = CASE WHEN status IN ('READ', 'DELIVERED') THEN status ELSE 'SENT' END,
          sent_at = COALESCE(sent_at, NULLIF(p_result->>'sentAt', '')::timestamptz, now()),
          status_updated_at = now(), error_message = NULL, provider_error_code = NULL
      WHERE id = v_command.message_id;
    ELSIF p_status = 'ambiguous' OR v_provider_accepted THEN
      UPDATE public.messages
      SET status = 'AMBIGUOUS',
          imessage_temp_guid = COALESCE(imessage_temp_guid, NULLIF(p_result->>'tempGuid', ''), v_command.id::text),
          status_updated_at = now(), error_message = p_error
      WHERE id = v_command.message_id
        AND status NOT IN ('SENT', 'DELIVERED', 'READ');
    ELSIF p_status = 'failed' THEN
      UPDATE public.messages
      SET status = 'FAILED', status_updated_at = now(), error_message = p_error,
          provider_error_at = now(), provider_error_code = NULLIF(p_result->>'errorCode', '')
      WHERE id = v_command.message_id
        AND status NOT IN ('SENT', 'DELIVERED', 'READ');
    END IF;
  END IF;
  RETURN v_command;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_imessage_connector(
  p_connector_id text,
  p_status text,
  p_app_version text DEFAULT NULL,
  p_host_label text DEFAULT NULL,
  p_capabilities jsonb DEFAULT '[]'::jsonb,
  p_metrics jsonb DEFAULT '{}'::jsonb,
  p_last_error_code text DEFAULT NULL
)
RETURNS public.imessage_connector_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_state public.imessage_connector_state;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_connector_id !~ '^[A-Za-z0-9._-]{1,100}$'
     OR p_status NOT IN ('healthy', 'degraded', 'offline', 'paused')
     OR jsonb_typeof(COALESCE(p_capabilities, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_metrics, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid heartbeat';
  END IF;
  INSERT INTO public.imessage_connector_state (
    connector_id, status, last_heartbeat_at, app_version, host_label,
    capabilities, metrics, last_error_code
  ) VALUES (
    p_connector_id, p_status, now(), left(p_app_version, 100), left(p_host_label, 100),
    COALESCE(p_capabilities, '[]'::jsonb), COALESCE(p_metrics, '{}'::jsonb),
    left(p_last_error_code, 100)
  )
  ON CONFLICT (connector_id) DO UPDATE SET
    status = EXCLUDED.status, last_heartbeat_at = now(),
    app_version = EXCLUDED.app_version, host_label = EXCLUDED.host_label,
    capabilities = EXCLUDED.capabilities, metrics = EXCLUDED.metrics,
    last_error_code = EXCLUDED.last_error_code, updated_at = now()
  RETURNING * INTO v_state;
  RETURN v_state;
END;
$$;

REVOKE ALL ON FUNCTION public.imessage_is_destructive(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.imessage_validate_command(text, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_imessage_command(text, uuid, uuid, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_imessage_send_command(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.imessage_queue_outbound_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_imessage_commands(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_imessage_command(uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heartbeat_imessage_connector(text, text, text, text, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_imessage_command(text, uuid, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_imessage_send_command(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_imessage_commands(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_imessage_command(uuid, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_imessage_connector(text, text, text, text, jsonb, jsonb, text) TO service_role;

DELETE FROM public.message_attachments older
USING public.message_attachments newer
WHERE older.message_id = newer.message_id
  AND older.storage_url = newer.storage_url
  AND older.id > newer.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_attachments_message_storage
  ON public.message_attachments(message_id, storage_url);

COMMENT ON TABLE public.imessage_commands IS
  'Durable connector outbox. Supabase is canonical; connectors claim work by pull.';
COMMENT ON TABLE public.imessage_connector_state IS
  'Sanitized connector heartbeat/status only; never stores connector secrets.';
COMMENT ON TABLE public.imessage_events IS
  'Replay-safe durable inbox for dedicated-Mac iMessage events.';
