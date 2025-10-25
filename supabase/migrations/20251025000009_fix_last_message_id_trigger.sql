-- Fix the trigger to also set last_message_id
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = COALESCE(NEW.sent_at, NEW.received_at, NEW.created_at, NOW()),
    last_message_id = NEW.id
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

-- Backfill last_message_id for existing conversations
UPDATE conversations c
SET last_message_id = (
  SELECT m.id
  FROM messages m
  WHERE m.conversation_id = c.id
  ORDER BY COALESCE(m.sent_at, m.received_at, m.created_at) DESC
  LIMIT 1
)
WHERE c.last_message_id IS NULL
  AND EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id);

