-- Conversation history has no user-facing deletion lifecycle (DEV-276).
REVOKE DELETE, TRUNCATE ON public.messages, public.conversations FROM anon, authenticated;

-- Foreign-key cascades do not apply row policies or child-table privileges.
-- Trusted service reconciliation may still consolidate duplicate provider rows.
CREATE FUNCTION admin_retention.protect_message_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     OR COALESCE((SELECT auth.jwt()->>'role'), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Message deletion is not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION admin_retention.protect_message_history() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER protect_message_history BEFORE DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION admin_retention.protect_message_history();

-- Retain the command audit trail, cancel unclaimed deletion requests and mark
-- already claimed requests uncertain: provider acceptance cannot be inferred.
UPDATE public.imessage_commands
SET status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE 'ambiguous' END,
    completed_at = now(), updated_at = now(),
    error = CASE WHEN status = 'queued' THEN 'Message deletion is not allowed'
      ELSE 'Message deletion disabled; an existing provider claim may have executed' END
WHERE command_type IN ('delete_message', 'delete_chat') AND status IN ('queued', 'claimed');
ALTER TABLE public.imessage_commands ADD CONSTRAINT imessage_commands_preserve_message_history
CHECK (command_type NOT IN ('delete_message', 'delete_chat') OR status NOT IN ('queued', 'claimed'));
