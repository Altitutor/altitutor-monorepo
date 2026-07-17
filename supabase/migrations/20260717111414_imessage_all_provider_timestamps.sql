-- Correct legacy and webhook-replayed iMessages that were not tagged as
-- reconciliation imports but still used their database insertion time.

UPDATE public.messages
SET is_historical_import = true
WHERE imessage_guid IS NOT NULL
  AND COALESCE(sent_at, received_at) IS NOT NULL
  AND created_at > COALESCE(sent_at, received_at) + interval '5 minutes';

UPDATE public.messages
SET
  created_at = COALESCE(sent_at, received_at, created_at),
  status_updated_at = COALESCE(
    read_at,
    delivered_at,
    sent_at,
    received_at,
    created_at
  )
WHERE imessage_guid IS NOT NULL
  AND (
    created_at IS DISTINCT FROM COALESCE(sent_at, received_at, created_at)
    OR status_updated_at IS DISTINCT FROM COALESCE(
      read_at,
      delivered_at,
      sent_at,
      received_at,
      created_at
    )
  );

WITH imessage_conversations AS (
  SELECT conversation.id
  FROM public.conversations AS conversation
  JOIN public.owned_numbers AS owned_number
    ON owned_number.id = conversation.owned_number_id
  WHERE owned_number.provider = 'IMESSAGE'
)
UPDATE public.conversations AS conversation
SET
  last_message_id = NULL,
  last_message_at = NULL,
  last_message_direction = NULL
FROM imessage_conversations
WHERE conversation.id = imessage_conversations.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages AS message
    WHERE message.conversation_id = conversation.id
  );

WITH latest_message AS (
  SELECT DISTINCT ON (message.conversation_id)
    message.conversation_id,
    message.id,
    message.direction,
    COALESCE(
      message.sent_at,
      message.received_at,
      message.created_at
    ) AS message_at
  FROM public.messages AS message
  JOIN public.conversations AS conversation
    ON conversation.id = message.conversation_id
  JOIN public.owned_numbers AS owned_number
    ON owned_number.id = conversation.owned_number_id
  WHERE owned_number.provider = 'IMESSAGE'
  ORDER BY
    message.conversation_id,
    COALESCE(message.sent_at, message.received_at, message.created_at) DESC,
    message.created_at DESC,
    message.id DESC
)
UPDATE public.conversations AS conversation
SET
  last_message_id = latest_message.id,
  last_message_at = latest_message.message_at,
  last_message_direction = latest_message.direction
FROM latest_message
WHERE conversation.id = latest_message.conversation_id;

WITH latest_historical AS (
  SELECT DISTINCT ON (message.conversation_id)
    message.conversation_id,
    message.id AS message_id
  FROM public.messages AS message
  WHERE message.direction = 'INBOUND'
    AND message.is_historical_import
    AND NOT EXISTS (
      SELECT 1
      FROM public.messages AS live_message
      WHERE live_message.conversation_id = message.conversation_id
        AND live_message.direction = 'INBOUND'
        AND NOT live_message.is_historical_import
    )
  ORDER BY
    message.conversation_id,
    COALESCE(message.received_at, message.created_at) DESC,
    message.created_at DESC,
    message.id DESC
)
INSERT INTO public.conversation_reads (
  conversation_id,
  staff_id,
  last_read_message_id,
  last_read_at
)
SELECT
  latest_historical.conversation_id,
  staff.id,
  latest_historical.message_id,
  now()
FROM latest_historical
CROSS JOIN public.staff AS staff
WHERE staff.role = 'ADMINSTAFF'
  AND staff.status = 'ACTIVE'
ON CONFLICT (conversation_id, staff_id)
DO UPDATE SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_read_at = EXCLUDED.last_read_at;
