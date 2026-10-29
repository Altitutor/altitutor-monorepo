-- An unread conversation can be handed to one active admin staff member.
-- Reading it or confirming a reply removes that handoff. While it remains,
-- a new live inbound message notifies the assignee. The assignee is also
-- notified when the handoff is created or moved to them.

CREATE FUNCTION private.conversation_notification_target(p_conversation_id uuid)
RETURNS TABLE(action_url text, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN conversation.is_group_chat THEN '/messages?group=' || conversation.id::text
      ELSE '/messages?contact=' || conversation.contact_id::text
    END,
    COALESCE(
      NULLIF(conversation.group_chat_name, ''),
      NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' ', student.first_name, student.last_name)), ''),
      NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' ', parent.first_name, parent.last_name)), ''),
      NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' ', contact_staff.first_name, contact_staff.last_name)), ''),
      contact.phone_e164,
      contact.email,
      'a conversation'
    )
  FROM public.conversations AS conversation
  LEFT JOIN public.contacts AS contact ON contact.id = conversation.contact_id
  LEFT JOIN public.students AS student ON student.id = contact.student_id
  LEFT JOIN public.parents AS parent ON parent.id = contact.parent_id
  LEFT JOIN public.staff AS contact_staff ON contact_staff.id = contact.staff_id
  WHERE conversation.id = p_conversation_id;
$$;

CREATE FUNCTION private.conversation_is_unread(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations AS conversation
    WHERE conversation.id = p_conversation_id
      AND conversation.status IN ('OPEN', 'SNOOZED')
      AND EXISTS (
        SELECT 1
        FROM public.messages AS message
        WHERE message.conversation_id = conversation.id
          AND message.direction = 'INBOUND'
          AND NOT message.is_historical_import
          AND NOT message.is_reaction
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversation_reads AS conversation_read
        WHERE conversation_read.conversation_id = conversation.id
      )
  );
$$;

CREATE FUNCTION private.notify_conversation_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_url text;
  v_label text;
BEGIN
  IF NEW.assigned_staff_id IS NOT DISTINCT FROM OLD.assigned_staff_id
    OR NEW.assigned_staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff AS staff
    WHERE staff.id = NEW.assigned_staff_id
      AND staff.role = 'ADMINSTAFF'
      AND staff.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'conversation assignee must be an active adminstaff'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT private.conversation_is_unread(NEW.id) THEN
    RAISE EXCEPTION 'only an unread conversation can be assigned'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT target.action_url, target.label
  INTO v_action_url, v_label
  FROM private.conversation_notification_target(NEW.id) AS target;

  INSERT INTO public.notifications (
    staff_id, app_scope, notification_type, title, body, action_url,
    dedupe_key, priority, metadata
  ) VALUES (
    NEW.assigned_staff_id,
    'staff_web',
    'CONVERSATION_ASSIGNED',
    'Assigned: ' || COALESCE(v_label, 'a conversation'),
    'This unread conversation was assigned to you.',
    v_action_url,
    'conversation:assigned:' || NEW.id::text || ':' || NEW.assigned_staff_id::text || ':' || gen_random_uuid()::text,
    'important',
    pg_catalog.jsonb_build_object('conversation_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE FUNCTION private.clear_conversation_assignment_on_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET assigned_staff_id = NULL
  WHERE id = NEW.conversation_id
    AND assigned_staff_id IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.notify_assigned_conversation_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignee uuid;
  v_action_url text;
  v_label text;
BEGIN
  IF NEW.direction <> 'INBOUND'
    OR NEW.is_reaction
    OR NEW.is_historical_import THEN
    RETURN NEW;
  END IF;

  SELECT conversation.assigned_staff_id
  INTO v_assignee
  FROM public.conversations AS conversation
  WHERE conversation.id = NEW.conversation_id;

  IF v_assignee IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT target.action_url, target.label
  INTO v_action_url, v_label
  FROM private.conversation_notification_target(NEW.conversation_id) AS target;

  INSERT INTO public.notifications (
    staff_id, app_scope, notification_type, title, body, action_url,
    dedupe_key, priority, metadata
  ) VALUES (
    v_assignee,
    'staff_web',
    'CONVERSATION_MESSAGE',
    'New message from ' || COALESCE(v_label, 'a conversation'),
    pg_catalog.left(pg_catalog.btrim(NEW.body), 160),
    v_action_url,
    'conversation:assigned-message:' || NEW.id::text,
    'important',
    pg_catalog.jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.conversation_notification_target(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.conversation_is_unread(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_conversation_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.clear_conversation_assignment_on_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_assigned_conversation_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_conversation_assignment ON public.conversations;
CREATE TRIGGER notify_conversation_assignment
AFTER UPDATE OF assigned_staff_id ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION private.notify_conversation_assignment();

DROP TRIGGER IF EXISTS clear_conversation_assignment_on_read ON public.conversation_reads;
CREATE TRIGGER clear_conversation_assignment_on_read
AFTER INSERT OR UPDATE ON public.conversation_reads
FOR EACH ROW
EXECUTE FUNCTION private.clear_conversation_assignment_on_read();

DROP TRIGGER IF EXISTS notify_assigned_conversation_message ON public.messages;
CREATE TRIGGER notify_assigned_conversation_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION private.notify_assigned_conversation_message();
