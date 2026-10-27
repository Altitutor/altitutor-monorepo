-- Correlate provider callbacks atomically. A retry must never detach history
-- or overwrite a different provider identity to escape a uniqueness violation.
CREATE FUNCTION public.reconcile_imessage_inbound(
  p_message jsonb,
  p_attachments jsonb,
  p_from_live boolean,
  p_historical boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  incoming public.messages;
  retained public.messages;
  provider public.messages;
  temporary public.messages;
  duplicate public.messages;
  attachment jsonb;
  lock_key bigint;
  next_status text;
  candidate_status text;
  current_rank integer;
  candidate_rank integer;
  is_new boolean := false;
BEGIN
  incoming := pg_catalog.jsonb_populate_record(NULL::public.messages, p_message);
  IF incoming.imessage_guid IS NULL OR incoming.conversation_id IS NULL
    OR incoming.direction IS NULL OR incoming.direction NOT IN ('INBOUND', 'OUTBOUND')
    OR incoming.status IS NULL OR incoming.status NOT IN ('SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED')
    OR incoming.created_at IS NULL THEN
    RAISE EXCEPTION 'Invalid inbound message';
  END IF;

  -- Shared identities serialize even when the row does not exist yet.
  FOR lock_key IN
    SELECT DISTINCT pg_catalog.hashtextextended(identity, 245)
    FROM pg_catalog.unnest(ARRAY[
      'guid:' || incoming.imessage_guid,
      CASE WHEN incoming.imessage_temp_guid IS NOT NULL
        THEN 'temp:' || incoming.imessage_temp_guid END
    ]) AS identities(identity)
    WHERE identity IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(lock_key);
  END LOOP;

  -- Lock in stable order before inspecting either occupied identity.
  PERFORM id FROM public.messages
  WHERE imessage_guid = incoming.imessage_guid
    OR (incoming.imessage_temp_guid IS NOT NULL
      AND imessage_temp_guid = incoming.imessage_temp_guid)
  ORDER BY id FOR UPDATE;
  SELECT * INTO provider FROM public.messages
    WHERE imessage_guid = incoming.imessage_guid;
  IF incoming.imessage_temp_guid IS NOT NULL THEN
    SELECT * INTO temporary FROM public.messages
      WHERE imessage_temp_guid = incoming.imessage_temp_guid;
  END IF;

  IF provider.id IS NOT NULL AND (
      provider.conversation_id <> incoming.conversation_id
      OR provider.direction <> incoming.direction
      OR (incoming.imessage_temp_guid IS NOT NULL
        AND provider.imessage_temp_guid IS NOT NULL
        AND provider.imessage_temp_guid <> incoming.imessage_temp_guid)
    ) THEN
    RAISE EXCEPTION 'Conflicting iMessage provider identity';
  END IF;
  IF temporary.id IS NOT NULL AND (
      temporary.conversation_id <> incoming.conversation_id
      OR temporary.direction <> 'OUTBOUND' OR incoming.direction <> 'OUTBOUND'
      OR (temporary.imessage_guid IS NOT NULL
        AND temporary.imessage_guid <> incoming.imessage_guid)
    ) THEN
    RAISE EXCEPTION 'Conflicting iMessage temporary identity';
  END IF;

  retained := CASE WHEN temporary.id IS NOT NULL THEN temporary ELSE provider END;
  IF provider.id IS NOT NULL AND temporary.id IS NOT NULL
    AND provider.id <> temporary.id THEN
    duplicate := provider;
    IF (retained.created_by_staff_id IS NOT NULL
        AND duplicate.created_by_staff_id IS NOT NULL
        AND retained.created_by_staff_id <> duplicate.created_by_staff_id)
      OR (retained.apple_service IS NOT NULL AND duplicate.apple_service IS NOT NULL
        AND retained.apple_service <> duplicate.apple_service)
      OR retained.resent_from_message_id = duplicate.id
      OR duplicate.resent_from_message_id = retained.id THEN
      RAISE EXCEPTION 'Conflicting iMessage message history';
    END IF;

    -- Same attachment URL denotes the same attachment, preserving richer
    -- metadata on the original outbound row before moving the other URLs.
    UPDATE public.message_attachments AS original
    SET filename = COALESCE(original.filename, other.filename),
      mime_type = COALESCE(original.mime_type, other.mime_type),
      size_bytes = COALESCE(original.size_bytes, other.size_bytes)
    FROM public.message_attachments AS other
    WHERE original.message_id = retained.id AND other.message_id = duplicate.id
      AND original.storage_url = other.storage_url;
    DELETE FROM public.message_attachments AS other
    USING public.message_attachments AS original
    WHERE other.message_id = duplicate.id AND original.message_id = retained.id
      AND other.storage_url = original.storage_url;

    -- Reparent every current FK-backed history before deleting the duplicate.
    UPDATE public.message_attachments SET message_id = retained.id
      WHERE message_id = duplicate.id;
    UPDATE public.imessage_commands SET message_id = retained.id
      WHERE message_id = duplicate.id;
    UPDATE public.automation_message_deliveries SET message_id = retained.id
      WHERE message_id = duplicate.id;
    UPDATE public.conversation_reads SET
      last_read_message_id = CASE WHEN last_read_message_id = duplicate.id
        THEN retained.id ELSE last_read_message_id END,
      auto_read_message_id = CASE WHEN auto_read_message_id = duplicate.id
        THEN retained.id ELSE auto_read_message_id END
      WHERE last_read_message_id = duplicate.id OR auto_read_message_id = duplicate.id;
    UPDATE public.messages SET resent_from_message_id = retained.id
      WHERE resent_from_message_id = duplicate.id;
    UPDATE public.conversations SET last_message_id = retained.id
      WHERE last_message_id = duplicate.id;
    DELETE FROM public.messages WHERE id = duplicate.id;
  END IF;

  IF retained.id IS NULL THEN
    INSERT INTO public.messages (
      conversation_id, direction, body, from_number_e164, to_number_e164,
      status, status_updated_at, message_sid, imessage_guid, imessage_temp_guid,
      is_reaction, reaction_type, associated_message_guid, created_at,
      sent_at, received_at, delivered_at, read_at, provider_error_at,
      provider_error_code, error_message, is_historical_import, apple_service
    ) VALUES (
      incoming.conversation_id, incoming.direction, incoming.body,
      incoming.from_number_e164, incoming.to_number_e164, incoming.status,
      incoming.status_updated_at, incoming.message_sid, incoming.imessage_guid,
      incoming.imessage_temp_guid, incoming.is_reaction, incoming.reaction_type,
      incoming.associated_message_guid, incoming.created_at, incoming.sent_at,
      incoming.received_at, incoming.delivered_at, incoming.read_at,
      incoming.provider_error_at, incoming.provider_error_code,
      incoming.error_message, p_historical, incoming.apple_service
    ) RETURNING * INTO retained;
    is_new := true;
  ELSE
    next_status := retained.status;
    FOREACH candidate_status IN ARRAY ARRAY[duplicate.status, incoming.status]
    LOOP
      IF candidate_status IS NULL THEN CONTINUE; END IF;
      IF candidate_status = 'FAILED' THEN
        IF next_status NOT IN ('DELIVERED', 'READ') THEN next_status := 'FAILED'; END IF;
      ELSIF next_status = 'FAILED' AND candidate_status = 'SENT' THEN
        CONTINUE;
      ELSE
        current_rank := CASE next_status
          WHEN 'QUEUED' THEN 0 WHEN 'SENDING' THEN 1
          WHEN 'AMBIGUOUS' THEN 2 WHEN 'UNDELIVERED' THEN 2 WHEN 'FAILED' THEN 2
          WHEN 'SENT' THEN 3 WHEN 'DELIVERED' THEN 4 ELSE 5 END;
        candidate_rank := CASE candidate_status
          WHEN 'QUEUED' THEN 0 WHEN 'SENDING' THEN 1
          WHEN 'AMBIGUOUS' THEN 2 WHEN 'UNDELIVERED' THEN 2 WHEN 'FAILED' THEN 2
          WHEN 'SENT' THEN 3 WHEN 'DELIVERED' THEN 4 ELSE 5 END;
        IF candidate_rank >= current_rank THEN next_status := candidate_status; END IF;
      END IF;
    END LOOP;
    UPDATE public.messages SET
      imessage_guid = incoming.imessage_guid,
      imessage_temp_guid = COALESCE(incoming.imessage_temp_guid, retained.imessage_temp_guid),
      message_sid = COALESCE(incoming.message_sid, retained.message_sid, duplicate.message_sid),
      status = next_status,
      created_at = incoming.created_at,
      status_updated_at = GREATEST(retained.status_updated_at,
        duplicate.status_updated_at, incoming.status_updated_at),
      sent_at = COALESCE(incoming.sent_at, retained.sent_at, duplicate.sent_at),
      received_at = COALESCE(incoming.received_at, retained.received_at, duplicate.received_at),
      delivered_at = COALESCE(incoming.delivered_at, retained.delivered_at, duplicate.delivered_at),
      read_at = COALESCE(incoming.read_at, retained.read_at, duplicate.read_at),
      provider_error_at = CASE WHEN next_status = 'FAILED'
        THEN COALESCE(incoming.provider_error_at, retained.provider_error_at, duplicate.provider_error_at)
        ELSE retained.provider_error_at END,
      provider_error_code = CASE WHEN next_status = 'FAILED'
        THEN COALESCE(incoming.provider_error_code, retained.provider_error_code, duplicate.provider_error_code)
        ELSE retained.provider_error_code END,
      created_by_staff_id = COALESCE(retained.created_by_staff_id, duplicate.created_by_staff_id),
      is_historical_import = CASE WHEN p_from_live THEN false
        ELSE retained.is_historical_import AND COALESCE(duplicate.is_historical_import, true) END,
      apple_service = COALESCE(retained.apple_service, duplicate.apple_service, incoming.apple_service)
    WHERE id = retained.id;
  END IF;

  FOR attachment IN SELECT * FROM pg_catalog.jsonb_array_elements(p_attachments)
  LOOP
    INSERT INTO public.message_attachments (
      message_id, storage_url, filename, mime_type, size_bytes
    ) VALUES (
      retained.id, attachment->>'storage_url', attachment->>'filename',
      attachment->>'mime_type', (attachment->>'size_bytes')::bigint
    ) ON CONFLICT (message_id, storage_url) DO NOTHING;
  END LOOP;
  IF NOT incoming.is_reaction THEN
    UPDATE public.conversations SET last_message_at = incoming.created_at
      WHERE id = incoming.conversation_id
        AND (last_message_at IS NULL OR last_message_at < incoming.created_at);
  END IF;
  IF incoming.direction = 'INBOUND' AND (is_new OR p_from_live) THEN
    PERFORM public.sync_imessage_message_read_state(
      incoming.conversation_id, retained.id, CASE WHEN is_new THEN p_historical ELSE false END
    );
  END IF;
  RETURN retained.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_imessage_inbound(jsonb, jsonb, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_imessage_inbound(jsonb, jsonb, boolean, boolean)
  TO service_role;
