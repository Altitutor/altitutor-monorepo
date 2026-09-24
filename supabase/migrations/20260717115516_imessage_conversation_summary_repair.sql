-- Historical sync can create a conversation before its first message. Older
-- code initialized last_message_at to now(), preventing the chronological
-- message trigger from replacing it with an older provider timestamp.

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
