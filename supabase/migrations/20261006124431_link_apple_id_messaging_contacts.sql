-- Apple ID handles use existing contacts.email; profile email stays independent.
CREATE INDEX contacts_normalized_email_idx ON public.contacts (lower(btrim(email)));

-- Serialise email resolution/linking so concurrent bridge events reuse one contact.
CREATE FUNCTION public.link_messaging_email_contact(p_contact_id uuid, p_entity_type text, p_entity_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source public.contacts%ROWTYPE;
  target public.contacts%ROWTYPE;
  source_conversation public.conversations%ROWTYPE;
  target_conversation public.conversations%ROWTYPE;
  target_id uuid;
  candidate_count integer;
  profile_phone text;
  profile_email text;
  was_unread boolean;
BEGIN
  IF NOT (COALESCE(auth.role(), '') = 'service_role' OR public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('messaging-email-link', 0));
  SELECT * INTO source FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF source.id IS NULL OR NULLIF(btrim(source.email), '') IS NULL OR source.phone_e164 IS NOT NULL THEN
    RAISE EXCEPTION 'Select an email-only contact';
  END IF;
  IF source.student_id IS NOT NULL OR source.parent_id IS NOT NULL OR source.staff_id IS NOT NULL THEN
    IF (p_entity_type = 'student' AND source.student_id = p_entity_id)
      OR (p_entity_type = 'parent' AND source.parent_id = p_entity_id)
      OR (p_entity_type = 'staff' AND source.staff_id = p_entity_id) THEN RETURN source.id; END IF;
    RAISE EXCEPTION 'This Apple ID is already linked to another person';
  END IF;
  IF p_entity_type = 'student' THEN
    SELECT phone, email INTO profile_phone, profile_email FROM public.students WHERE id = p_entity_id;
  ELSIF p_entity_type = 'parent' THEN
    SELECT phone, email INTO profile_phone, profile_email FROM public.parents WHERE id = p_entity_id;
  ELSIF p_entity_type = 'staff' THEN
    SELECT phone_number, email INTO profile_phone, profile_email FROM public.staff WHERE id = p_entity_id;
  ELSE RAISE EXCEPTION 'Invalid person type'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;

  SELECT count(*), (array_agg(id ORDER BY created_at, id))[1] INTO candidate_count, target_id
  FROM public.contacts WHERE
    (p_entity_type = 'student' AND student_id = p_entity_id) OR
    (p_entity_type = 'parent' AND parent_id = p_entity_id) OR
    (p_entity_type = 'staff' AND staff_id = p_entity_id);
  IF candidate_count > 1 THEN RAISE EXCEPTION 'This person has multiple contacts; resolve those before linking'; END IF;
  -- Reuse an unlinked phone contact if the profile was not synchronised yet.
  IF target_id IS NULL AND profile_phone IS NOT NULL THEN
    SELECT id INTO target_id FROM public.contacts WHERE phone_e164 = profile_phone;
  END IF;
  IF target_id IS NULL THEN
    UPDATE public.contacts SET email = lower(btrim(email)), phone_e164 = profile_phone,
      contact_type = upper(p_entity_type),
      student_id = CASE WHEN p_entity_type = 'student' THEN p_entity_id END,
      parent_id = CASE WHEN p_entity_type = 'parent' THEN p_entity_id END,
      staff_id = CASE WHEN p_entity_type = 'staff' THEN p_entity_id END
    WHERE id = source.id;
    RETURN source.id;
  END IF;

  SELECT * INTO target FROM public.contacts WHERE id = target_id FOR UPDATE;
  IF (target.student_id IS NOT NULL AND NOT (p_entity_type = 'student' AND target.student_id = p_entity_id))
    OR (target.parent_id IS NOT NULL AND NOT (p_entity_type = 'parent' AND target.parent_id = p_entity_id))
    OR (target.staff_id IS NOT NULL AND NOT (p_entity_type = 'staff' AND target.staff_id = p_entity_id)) THEN
    RAISE EXCEPTION 'The phone contact belongs to another person';
  END IF;
  -- An unused profile-email copy is not an established Apple ID address.
  IF NULLIF(btrim(target.email), '') IS NOT NULL AND lower(btrim(target.email)) <> lower(btrim(source.email))
    AND NOT (lower(btrim(target.email)) = COALESCE(lower(btrim(profile_email)), '')
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
        WHERE c.contact_id = target.id AND
          (lower(btrim(m.from_number_e164)) = lower(btrim(target.email)) OR lower(btrim(m.to_number_e164)) = lower(btrim(target.email)))
      )) THEN
    RAISE EXCEPTION 'This person already has a different Apple ID email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contacts c WHERE lower(btrim(c.email)) = lower(btrim(source.email))
    AND c.id NOT IN (source.id, target.id)
    AND (c.student_id IS NOT NULL OR c.parent_id IS NOT NULL OR c.staff_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'This Apple ID is already linked to another person';
  END IF;

  UPDATE public.contacts SET email = lower(btrim(source.email)), contact_type = upper(p_entity_type),
    student_id = CASE WHEN p_entity_type = 'student' THEN p_entity_id END,
    parent_id = CASE WHEN p_entity_type = 'parent' THEN p_entity_id END,
    staff_id = CASE WHEN p_entity_type = 'staff' THEN p_entity_id END,
    is_opted_out = target.is_opted_out OR source.is_opted_out,
    opted_out_at = COALESCE(target.opted_out_at, source.opted_out_at)
  WHERE id = target.id;

  FOR source_conversation IN SELECT * FROM public.conversations WHERE contact_id = source.id ORDER BY id FOR UPDATE LOOP
    target_conversation := NULL;
    IF source_conversation.status IN ('OPEN', 'SNOOZED') THEN
      SELECT * INTO target_conversation FROM public.conversations
      WHERE contact_id = target.id AND owned_number_id = source_conversation.owned_number_id
        AND status IN ('OPEN', 'SNOOZED') AND NOT is_group_chat FOR UPDATE;
    END IF;
    IF target_conversation.id IS NOT NULL THEN
      -- Any unread live inbound thread keeps the combined history unread.
      SELECT EXISTS (
        SELECT 1 FROM public.conversations c WHERE c.id IN (source_conversation.id, target_conversation.id)
          AND NOT EXISTS (SELECT 1 FROM public.conversation_reads r WHERE r.conversation_id = c.id)
          AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
            AND m.direction = 'INBOUND' AND NOT m.is_historical_import AND NOT m.is_reaction)
      ) INTO was_unread;
      UPDATE public.messages SET conversation_id = target_conversation.id WHERE conversation_id = source_conversation.id;
      UPDATE public.imessage_commands SET conversation_id = target_conversation.id WHERE conversation_id = source_conversation.id;
      IF was_unread THEN
        DELETE FROM public.conversation_reads WHERE conversation_id IN (source_conversation.id, target_conversation.id);
      ELSE
        INSERT INTO public.conversation_reads (conversation_id, staff_id, last_read_message_id, last_read_at, auto_read_message_id)
        SELECT target_conversation.id, staff_id, last_read_message_id, last_read_at, auto_read_message_id
        FROM public.conversation_reads WHERE conversation_id = source_conversation.id
        ON CONFLICT (conversation_id, staff_id) DO NOTHING;
      END IF;
      UPDATE public.conversations SET
        needs_follow_up = target_conversation.needs_follow_up OR source_conversation.needs_follow_up,
        is_pinned = target_conversation.is_pinned OR source_conversation.is_pinned,
        assigned_staff_id = COALESCE(target_conversation.assigned_staff_id, source_conversation.assigned_staff_id),
        status = CASE WHEN target_conversation.status = 'OPEN' OR source_conversation.status = 'OPEN' THEN 'OPEN' ELSE 'SNOOZED' END
      WHERE id = target_conversation.id;
      UPDATE public.conversations c SET last_message_id = m.id,
        last_message_at = COALESCE(m.sent_at, m.created_at), last_message_direction = m.direction
      FROM (SELECT id, direction, sent_at, created_at FROM public.messages WHERE conversation_id = target_conversation.id
        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1) m WHERE c.id = target_conversation.id;
      -- Keep the old conversation ID valid for existing references, without a second inbox entry.
      UPDATE public.conversations SET status = 'ARCHIVED', contact_id = target.id,
        last_message_id = NULL, last_message_at = NULL, last_message_direction = NULL WHERE id = source_conversation.id;
    ELSE
      UPDATE public.conversations SET contact_id = target.id WHERE id = source_conversation.id;
    END IF;
  END LOOP;
  INSERT INTO public.group_chat_participants (conversation_id, contact_id)
    SELECT conversation_id, target.id FROM public.group_chat_participants WHERE contact_id = source.id
    ON CONFLICT (conversation_id, contact_id) DO NOTHING;
  DELETE FROM public.group_chat_participants WHERE contact_id = source.id;
  UPDATE public.onboarding_journeys SET contact_id = target.id WHERE contact_id = source.id;
  -- Keep the unlinked source contact for historical delivery/merge audit references.
  -- Email resolution below prefers the linked canonical contact; it has all conversations.
  RETURN target.id;
END;
$$;
REVOKE ALL ON FUNCTION public.link_messaging_email_contact(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_messaging_email_contact(uuid,text,uuid) TO authenticated, service_role;

CREATE FUNCTION public.resolve_messaging_email_contact(p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handle text := lower(btrim(p_email));
  contact_id uuid;
  linked_count integer;
  matches integer;
  person_type text;
  person_id uuid;
  target_email text;
BEGIN
  IF NOT (COALESCE(auth.role(), '') = 'service_role' OR public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF handle IS NULL OR handle !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid Apple ID email';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('messaging-email-link', 0));
  SELECT count(*), (array_agg(id ORDER BY created_at, id))[1] INTO linked_count, contact_id
  FROM public.contacts WHERE lower(btrim(email)) = handle
    AND (student_id IS NOT NULL OR parent_id IS NOT NULL OR staff_id IS NOT NULL);
  IF linked_count = 1 THEN RETURN contact_id; END IF;

  SELECT id INTO contact_id FROM public.contacts WHERE lower(btrim(email)) = handle
    AND student_id IS NULL AND parent_id IS NULL AND staff_id IS NULL ORDER BY created_at, id LIMIT 1;
  IF contact_id IS NULL THEN
    INSERT INTO public.contacts (email, contact_type) VALUES (handle, 'LEAD') RETURNING id INTO contact_id;
  END IF;
  IF linked_count > 1 THEN RETURN contact_id; END IF;

  SELECT count(*), (array_agg(kind))[1], (array_agg(id))[1] INTO matches, person_type, person_id
  FROM (
    SELECT 'student' AS kind, id FROM public.students WHERE lower(btrim(email)) = handle
    UNION ALL SELECT 'parent', id FROM public.parents WHERE lower(btrim(email)) = handle
    UNION ALL SELECT 'staff', id FROM public.staff WHERE lower(btrim(email)) = handle
  ) people;
  IF matches <> 1 THEN RETURN contact_id; END IF;
  SELECT count(*), (array_agg(email))[1] INTO matches, target_email FROM public.contacts WHERE
    (person_type = 'student' AND student_id = person_id) OR
    (person_type = 'parent' AND parent_id = person_id) OR
    (person_type = 'staff' AND staff_id = person_id);
  IF matches > 1 THEN RETURN contact_id; END IF;
  -- A profile match must not replace an explicitly linked, different Apple ID.
  IF NULLIF(btrim(target_email), '') IS NOT NULL AND lower(btrim(target_email)) <> handle THEN RETURN contact_id; END IF;
  RETURN public.link_messaging_email_contact(contact_id, person_type, person_id);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_messaging_email_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_messaging_email_contact(text) TO authenticated, service_role;
