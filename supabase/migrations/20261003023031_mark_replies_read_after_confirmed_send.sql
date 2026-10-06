-- Remember which successful reply cleared unread state. A later delivery
-- failure may undo that automatic read, but must never undo a manual read.
ALTER TABLE public.conversation_reads
  ADD COLUMN auto_read_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
CREATE INDEX idx_conversation_reads_auto_read_message
  ON public.conversation_reads(auto_read_message_id)
  WHERE auto_read_message_id IS NOT NULL;

CREATE FUNCTION private.sync_reply_read_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_contact_id uuid;
  v_conversation_id uuid;
BEGIN
  IF NEW.direction <> 'OUTBOUND' OR NEW.is_reaction OR NEW.is_historical_import
    OR NEW.created_by_staff_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  END IF;

  IF NEW.status IN ('FAILED', 'UNDELIVERED') THEN
    DELETE FROM public.conversation_reads WHERE auto_read_message_id = NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('SENT', 'DELIVERED', 'READ') THEN RETURN NEW; END IF;

  SELECT contact_id INTO v_contact_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  -- Match the contact-wide manual read action, including replies from another
  -- owned number. Groups have no contact and only clear their own thread.
  FOR v_conversation_id IN
    SELECT c.id FROM public.conversations c
    WHERE c.status IN ('OPEN', 'SNOOZED')
      AND (c.id = NEW.conversation_id OR (v_contact_id IS NOT NULL AND c.contact_id = v_contact_id))
    ORDER BY c.id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_conversation_id::text, 0));
    -- A reply cannot acknowledge an inbound message that arrived after it was queued.
    IF EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.conversation_id = v_conversation_id AND m.direction = 'INBOUND'
        AND NOT m.is_historical_import AND NOT m.is_reaction
        AND m.created_at > NEW.created_at
    ) THEN CONTINUE; END IF;

    INSERT INTO public.conversation_reads AS existing (
      conversation_id, staff_id, last_read_message_id, last_read_at, auto_read_message_id
    ) VALUES (
      v_conversation_id, NEW.created_by_staff_id, NEW.id, NEW.created_at, NEW.id
    )
    ON CONFLICT (conversation_id, staff_id) DO UPDATE SET
      last_read_message_id = EXCLUDED.last_read_message_id,
      last_read_at = EXCLUDED.last_read_at,
      auto_read_message_id = EXCLUDED.auto_read_message_id
    WHERE existing.auto_read_message_id IS NOT NULL
      AND existing.last_read_at <= EXCLUDED.last_read_at;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_reply_read_state() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_reply_read_state
AFTER INSERT OR UPDATE OF status ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.sync_reply_read_state();

-- Unread is explicit read state plus live inbound traffic. Outbound queueing
-- must not hide it, and history-only/device-only conversations stay excluded.
CREATE FUNCTION public.get_unread_message_conversation_ids(p_conversation_ids uuid[] DEFAULT NULL)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN ARRAY(
    SELECT c.id FROM public.conversations c
    WHERE c.status IN ('OPEN', 'SNOOZED')
      AND (p_conversation_ids IS NULL OR c.id = ANY(p_conversation_ids))
      AND NOT EXISTS (SELECT 1 FROM public.conversation_reads r WHERE r.conversation_id = c.id)
      AND EXISTS (
        SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
          AND m.direction = 'INBOUND' AND NOT m.is_historical_import AND NOT m.is_reaction
      )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_unread_message_conversation_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_message_conversation_ids(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_unread_contact_conversation_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN (
    SELECT count(*)::integer FROM public.conversations c
    WHERE NOT c.is_group_chat AND c.status IN ('OPEN', 'SNOOZED')
      AND NOT EXISTS (SELECT 1 FROM public.conversation_reads r WHERE r.conversation_id = c.id)
      AND EXISTS (
        SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
          AND m.direction = 'INBOUND' AND NOT m.is_historical_import AND NOT m.is_reaction
      )
  );
END;
$$;
COMMENT ON FUNCTION public.get_unread_contact_conversation_count() IS
  'Counts unread live-inbound contact conversations until explicit read or successful reply';
