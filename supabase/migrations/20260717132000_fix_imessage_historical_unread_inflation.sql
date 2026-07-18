-- Historical iMessage re-sync was creating hundreds of "unread" conversations.
-- Unread is stored as absence of conversation_reads, so outbound-only and
-- history-only chats counted toward the navbar badge even though the inbox
-- list (top 500) barely showed them.
--
-- Fix:
-- 1) Unread badge requires a live (non-historical) INBOUND last message.
-- 2) Historical ingest always marks a conversation read when it should not
--    create unread state (no live inbound, or tip is still historical).
-- 3) Backfill conversation_reads for the inflated historical unread set.

CREATE OR REPLACE FUNCTION public.sync_imessage_message_read_state(
  p_conversation_id uuid,
  p_message_id uuid,
  p_historical boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  has_live_inbound boolean;
  last_is_historical boolean;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_conversation_id::text, 0)
  );

  IF p_historical THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.messages AS message
      WHERE message.conversation_id = p_conversation_id
        AND message.direction = 'INBOUND'
        AND NOT message.is_historical_import
    )
    INTO has_live_inbound;

    SELECT COALESCE(message.is_historical_import, false)
    INTO last_is_historical
    FROM public.conversations AS conversation
    LEFT JOIN public.messages AS message
      ON message.id = conversation.last_message_id
    WHERE conversation.id = p_conversation_id;

    -- Historical import must not leave the inbox unread. Mark read when there
    -- is no live inbound traffic, or when the conversation tip is still history.
    IF (NOT has_live_inbound) OR COALESCE(last_is_historical, true) THEN
      INSERT INTO public.conversation_reads (
        conversation_id,
        staff_id,
        last_read_message_id,
        last_read_at
      )
      SELECT
        p_conversation_id,
        staff.id,
        COALESCE(conversation.last_message_id, p_message_id),
        now()
      FROM public.staff AS staff
      CROSS JOIN public.conversations AS conversation
      WHERE staff.role = 'ADMINSTAFF'
        AND staff.status = 'ACTIVE'
        AND conversation.id = p_conversation_id
      ON CONFLICT (conversation_id, staff_id)
      DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = EXCLUDED.last_read_at;
    END IF;
  ELSE
    DELETE FROM public.conversation_reads
    WHERE conversation_id = p_conversation_id;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.sync_imessage_message_read_state(uuid, uuid, boolean) IS
  'Marks reconciled iMessage history read; clears read state for live inbound iMessage.';

CREATE OR REPLACE FUNCTION public.get_unread_contact_conversation_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM public.conversations AS conversation
    JOIN public.messages AS last_message
      ON last_message.id = conversation.last_message_id
    WHERE conversation.status IN ('OPEN', 'SNOOZED')
      AND COALESCE(conversation.is_group_chat, false) = false
      AND conversation.last_message_direction = 'INBOUND'
      AND last_message.is_historical_import = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversation_reads AS conversation_read
        WHERE conversation_read.conversation_id = conversation.id
      )
  );
END;
$$;

COMMENT ON FUNCTION public.get_unread_contact_conversation_count() IS
  'ADMINSTAFF-only count of unread live-inbound non-group OPEN/SNOOZED conversations for navbar badge';

-- Backfill: only conversations that currently look unread and should not —
-- no live inbound, historical tip, or outbound tip after history re-sync.
WITH conversations_to_mark_read AS (
  SELECT
    conversation.id AS conversation_id,
    COALESCE(conversation.last_message_id, latest_message.id) AS message_id
  FROM public.conversations AS conversation
  LEFT JOIN LATERAL (
    SELECT message.id
    FROM public.messages AS message
    WHERE message.conversation_id = conversation.id
    ORDER BY
      COALESCE(message.sent_at, message.received_at, message.created_at) DESC,
      message.created_at DESC,
      message.id DESC
    LIMIT 1
  ) AS latest_message ON true
  LEFT JOIN public.messages AS last_message
    ON last_message.id = conversation.last_message_id
  WHERE COALESCE(conversation.is_group_chat, false) = false
    AND COALESCE(conversation.last_message_id, latest_message.id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_reads AS conversation_read
      WHERE conversation_read.conversation_id = conversation.id
    )
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.messages AS message
        WHERE message.conversation_id = conversation.id
          AND message.direction = 'INBOUND'
          AND NOT message.is_historical_import
      )
      OR COALESCE(last_message.is_historical_import, false) = true
      OR conversation.last_message_direction IS DISTINCT FROM 'INBOUND'
    )
)
INSERT INTO public.conversation_reads (
  conversation_id,
  staff_id,
  last_read_message_id,
  last_read_at
)
SELECT
  conversations_to_mark_read.conversation_id,
  staff.id,
  conversations_to_mark_read.message_id,
  now()
FROM conversations_to_mark_read
CROSS JOIN public.staff AS staff
WHERE staff.role = 'ADMINSTAFF'
  AND staff.status = 'ACTIVE'
ON CONFLICT (conversation_id, staff_id)
DO UPDATE SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_read_at = EXCLUDED.last_read_at;
