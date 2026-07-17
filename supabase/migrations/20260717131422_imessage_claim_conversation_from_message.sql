-- Message-scoped iMessage commands (react/edit/unsend/delete) were often
-- enqueued without conversation_id. Claim then could not inject to/chatId/chatGuid.

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
  v_conversation_id uuid := p_conversation_id;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Active ADMINSTAFF required' USING ERRCODE = '42501';
  END IF;

  IF v_conversation_id IS NULL AND p_message_id IS NOT NULL THEN
    SELECT message.conversation_id
    INTO v_conversation_id
    FROM public.messages AS message
    WHERE message.id = p_message_id;
  END IF;

  v_staff_id := public.current_staff_id();
  v_destructive := public.imessage_is_destructive(p_command_type);
  IF v_destructive AND NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for destructive commands';
  END IF;
  PERFORM public.imessage_validate_command(
    p_command_type, p_message_id, v_conversation_id, COALESCE(p_payload, '{}'::jsonb)
  );
  v_key := COALESCE(
    NULLIF(p_idempotency_key, ''),
    'admin:' || v_staff_id::text || ':' || gen_random_uuid()::text
  );
  INSERT INTO public.imessage_commands (
    command_type, message_id, conversation_id, payload, idempotency_key,
    requested_by_staff_id, reason, destructive
  ) VALUES (
    p_command_type, p_message_id, v_conversation_id, COALESCE(p_payload, '{}'::jsonb),
    v_key, v_staff_id, NULLIF(btrim(p_reason), ''), v_destructive
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING * INTO v_command;
  RETURN v_command;
END;
$$;

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
        attempts = c.attempts + 1, updated_at = now(),
        conversation_id = COALESCE(
          c.conversation_id,
          (SELECT m.conversation_id FROM public.messages m WHERE m.id = c.message_id)
        )
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
  LEFT JOIN public.conversations c ON c.id = COALESCE(u.conversation_id, m.conversation_id)
  LEFT JOIN public.contacts ct ON ct.id = c.contact_id;
END;
$$;
