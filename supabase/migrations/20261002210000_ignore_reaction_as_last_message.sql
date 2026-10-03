-- Tapbacks are messages, but they are not a reply. Keep conversation
-- last-message fields on the latest non-reaction row so unreplied stays
-- tied to a real inbound message.

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  message_at timestamptz :=
    COALESCE(NEW.sent_at, NEW.received_at, NEW.created_at, now());
BEGIN
  IF NEW.is_reaction THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversations
  SET
    last_message_at = message_at,
    last_message_id = NEW.id,
    last_message_direction = NEW.direction
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR message_at >= last_message_at);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_conversations_needs_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_reaction THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'OUTBOUND' AND NEW.body LIKE '%?%' THEN
    UPDATE public.conversations
    SET needs_follow_up = true
    WHERE id = NEW.conversation_id;
  ELSIF NEW.direction = 'INBOUND' THEN
    UPDATE public.conversations
    SET needs_follow_up = false
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

WITH reaction_tips AS (
  SELECT conversation.id AS conversation_id
  FROM public.conversations AS conversation
  JOIN public.messages AS message
    ON message.id = conversation.last_message_id
  WHERE message.is_reaction
),
latest_substantive AS (
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
  JOIN reaction_tips
    ON reaction_tips.conversation_id = message.conversation_id
  WHERE message.is_reaction = false
  ORDER BY
    message.conversation_id,
    COALESCE(message.sent_at, message.received_at, message.created_at) DESC,
    message.created_at DESC,
    message.id DESC
)
UPDATE public.conversations AS conversation
SET
  last_message_id = latest_substantive.id,
  last_message_at = latest_substantive.message_at,
  last_message_direction = latest_substantive.direction
FROM latest_substantive
WHERE conversation.id = latest_substantive.conversation_id;

UPDATE public.conversations AS conversation
SET
  last_message_id = NULL,
  last_message_at = NULL,
  last_message_direction = NULL
WHERE EXISTS (
  SELECT 1
  FROM public.messages AS message
  WHERE message.id = conversation.last_message_id
    AND message.is_reaction
)
AND NOT EXISTS (
  SELECT 1
  FROM public.messages AS substantive
  WHERE substantive.conversation_id = conversation.id
    AND substantive.is_reaction = false
);
