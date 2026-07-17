-- Keep reconciled iMessage history out of live unread state and notifications.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_historical_import boolean NOT NULL DEFAULT false;

UPDATE public.messages AS message
SET is_historical_import = true
FROM public.imessage_events AS event
WHERE event.imessage_guid = message.imessage_guid
  AND lower(COALESCE(event.payload->>'EventType', event.payload->>'eventType', '')) =
    'reconciliation-message';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_live_inbound
  ON public.messages(conversation_id)
  WHERE direction = 'INBOUND' AND is_historical_import = false;

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
    last_message_id = NEW.id
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR message_at >= last_message_at);
  RETURN NEW;
END;
$function$;

WITH latest_message AS (
  SELECT DISTINCT ON (message.conversation_id)
    message.conversation_id,
    message.id,
    COALESCE(
      message.sent_at,
      message.received_at,
      message.created_at
    ) AS message_at
  FROM public.messages AS message
  ORDER BY
    message.conversation_id,
    COALESCE(message.sent_at, message.received_at, message.created_at) DESC,
    message.created_at DESC,
    message.id DESC
)
UPDATE public.conversations AS conversation
SET
  last_message_id = latest_message.id,
  last_message_at = latest_message.message_at
FROM latest_message
WHERE latest_message.conversation_id = conversation.id;

CREATE OR REPLACE FUNCTION public.sync_imessage_message_read_state(
  p_conversation_id uuid,
  p_message_id uuid,
  p_historical boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_conversation_id::text, 0)
  );

  IF p_historical THEN
    IF EXISTS (
      SELECT 1
      FROM public.messages AS message
      WHERE message.id = p_message_id
        AND message.conversation_id = p_conversation_id
        AND message.direction = 'INBOUND'
        AND message.is_historical_import
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.messages AS message
      WHERE message.conversation_id = p_conversation_id
        AND message.direction = 'INBOUND'
        AND NOT message.is_historical_import
    ) THEN
      INSERT INTO public.conversation_reads (
        conversation_id,
        staff_id,
        last_read_message_id,
        last_read_at
      )
      SELECT
        p_conversation_id,
        staff.id,
        p_message_id,
        now()
      FROM public.staff AS staff
      WHERE staff.role = 'ADMINSTAFF'
        AND staff.status = 'ACTIVE'
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

REVOKE ALL ON FUNCTION public.sync_imessage_message_read_state(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_imessage_message_read_state(uuid, uuid, boolean)
  TO service_role;

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

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unreplied_messages
WITH (security_invoker = false)
AS
SELECT
  conversation.id AS conversation_id,
  conversation.contact_id,
  conversation.status AS conversation_status,
  conversation.last_message_id,
  conversation.last_message_at,
  conversation.assigned_staff_id,
  COALESCE(
    CASE
      WHEN contact.contact_type = 'STUDENT' THEN (
        SELECT concat(student.first_name, ' ', student.last_name)
        FROM public.students AS student
        WHERE student.id = contact.student_id
      )
      WHEN contact.contact_type = 'PARENT' THEN (
        SELECT concat(parent.first_name, ' ', parent.last_name)
        FROM public.parents AS parent
        WHERE parent.id = contact.parent_id
      )
      WHEN contact.contact_type = 'STAFF' THEN (
        SELECT concat(staff.first_name, ' ', staff.last_name)
        FROM public.staff AS staff
        WHERE staff.id = contact.staff_id
      )
      ELSE NULL
    END,
    contact.phone_e164
  ) AS contact_name,
  contact.phone_e164 AS contact_phone,
  contact.contact_type,
  contact.student_id,
  contact.parent_id,
  contact.staff_id,
  last_message.id AS last_message_id_detail,
  last_message.direction AS last_message_direction,
  last_message.body AS last_message_preview,
  last_message.created_at AS last_message_created_at,
  extract(epoch FROM (now() - conversation.last_message_at)) / 3600 AS hours_since_last_message,
  conversation.created_at,
  conversation.updated_at
FROM public.conversations AS conversation
JOIN public.contacts AS contact ON contact.id = conversation.contact_id
LEFT JOIN public.messages AS last_message
  ON last_message.id = conversation.last_message_id
WHERE conversation.status IN ('OPEN', 'SNOOZED')
  AND last_message.direction = 'INBOUND'
  AND NOT last_message.is_historical_import
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages AS message
    WHERE message.conversation_id = conversation.id
      AND message.direction = 'OUTBOUND'
      AND message.created_at > last_message.created_at
  );

COMMENT ON COLUMN public.messages.is_historical_import IS
  'True for messages imported by iMessage reconciliation rather than received live.';
COMMENT ON FUNCTION public.sync_imessage_message_read_state(uuid, uuid, boolean) IS
  'Atomically marks reconciled history read or clears read state for a live inbound iMessage.';
