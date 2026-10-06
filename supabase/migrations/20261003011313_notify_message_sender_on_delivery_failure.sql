-- Every delivery provider writes messages.status. Keep sender alerts in the
-- durable inbox so late failures are visible even while the sender is offline.
CREATE OR REPLACE FUNCTION private.notify_message_sender_on_delivery_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_action_url text;
  v_recipient text;
BEGIN
  IF NEW.direction <> 'OUTBOUND'
    OR NEW.status NOT IN ('FAILED', 'UNDELIVERED')
    OR NEW.created_by_staff_id IS NULL
    OR NEW.is_historical_import THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT
    CASE WHEN c.is_group_chat THEN '/messages?group=' || c.id::text
      ELSE '/messages?contact=' || c.contact_id::text END,
    COALESCE(NULLIF(c.group_chat_name, ''),
      NULLIF(trim(concat_ws(' ', s.first_name, s.last_name)), ''),
      NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      NULLIF(trim(concat_ws(' ', st.first_name, st.last_name)), ''),
      ct.phone_e164, ct.email, NEW.to_number_e164, 'the recipient')
  INTO v_action_url, v_recipient
  FROM public.conversations c
  LEFT JOIN public.contacts ct ON ct.id = c.contact_id
  LEFT JOIN public.students s ON s.id = ct.student_id
  LEFT JOIN public.parents p ON p.id = ct.parent_id
  LEFT JOIN public.staff st ON st.id = ct.staff_id
  WHERE c.id = NEW.conversation_id;

  INSERT INTO public.notifications (
    staff_id, app_scope, notification_type, title, body, action_url,
    dedupe_key, priority, metadata
  ) VALUES (
    NEW.created_by_staff_id, 'staff_web', 'MESSAGE_DELIVERY_FAILED',
    'Message to ' || v_recipient || ' failed',
    'Your message could not be delivered. Open the conversation to review it.' ||
      CASE WHEN trim(NEW.body) <> '' THEN E'\n\n' || left(NEW.body, 160) ELSE '' END,
    v_action_url, 'message:delivery-failed:' || NEW.id::text, 'important',
    jsonb_build_object('message_id', NEW.id, 'conversation_id', NEW.conversation_id)
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_message_sender_on_delivery_failure()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_message_sender_on_delivery_failure
AFTER INSERT OR UPDATE OF status ON public.messages
FOR EACH ROW
EXECUTE FUNCTION private.notify_message_sender_on_delivery_failure();
