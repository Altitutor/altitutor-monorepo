-- Denormalize last message direction onto conversations so inbox lists do not
-- need a second messages?id=in.(...) GET (URL length / 400 failures).
-- Also expose a lightweight unread count RPC for the admin navbar badge.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_direction TEXT
  CHECK (
    last_message_direction IS NULL
    OR last_message_direction IN ('INBOUND', 'OUTBOUND')
  );

COMMENT ON COLUMN public.conversations.last_message_direction IS
  'Direction of last_message_id; maintained by update_conversation_last_message trigger';

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  message_at timestamptz :=
    COALESCE(NEW.sent_at, NEW.received_at, NEW.created_at, now());
BEGIN
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

UPDATE public.conversations c
SET last_message_direction = m.direction
FROM public.messages m
WHERE c.last_message_id = m.id
  AND (c.last_message_direction IS DISTINCT FROM m.direction);

-- Matches admin navbar badge: sum of unread OPEN/SNOOZED non-group conversations
-- (same semantics as AggregatedConversation.unreadCount summed across contacts).
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
    FROM public.conversations c
    WHERE c.status IN ('OPEN', 'SNOOZED')
      AND COALESCE(c.is_group_chat, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversation_reads cr
        WHERE cr.conversation_id = c.id
      )
  );
END;
$$;

COMMENT ON FUNCTION public.get_unread_contact_conversation_count() IS
  'ADMINSTAFF-only count of unread non-group OPEN/SNOOZED conversations for navbar badge';

REVOKE ALL ON FUNCTION public.get_unread_contact_conversation_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_contact_conversation_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_contact_conversation_count() TO service_role;
