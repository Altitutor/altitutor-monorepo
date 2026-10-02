-- Absence notifications render {session_name}. A reschedule links the missed
-- class and the makeup class, and the later session was overwriting that name.
-- Keep the subject session as session_name, then correct notices already stored.

CREATE OR REPLACE FUNCTION public.record_domain_event(
  p_event_name TEXT,
  p_subject_type TEXT,
  p_subject_id UUID,
  p_entities JSONB DEFAULT '[]'::JSONB,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_effective_at TIMESTAMPTZ DEFAULT NOW(),
  p_actor_staff_id UUID DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'application',
  p_dispatch_automations BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  event_id UUID;
  actor_id UUID := COALESCE(p_actor_staff_id, public.current_staff_id());
  normalized_entities JSONB;
  display_payload JSONB := '{}'::JSONB;
  entity JSONB;
  linked_entity_type TEXT;
  linked_entity_id UUID;
  linked_role TEXT;
  link_name TEXT;
  generic_name_key TEXT;
  subject_name_keys TEXT[] := '{}';
  rule_row RECORD;
  inserted_event BOOLEAN := FALSE;
BEGIN
  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'domain_event_subject_id_required';
  END IF;
  IF jsonb_typeof(COALESCE(p_entities, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'domain_event_entities_must_be_array';
  END IF;
  IF jsonb_typeof(COALESCE(p_payload, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'domain_event_payload_must_be_object';
  END IF;

  normalized_entities := jsonb_build_array(jsonb_build_object(
    'entity_type', p_subject_type,
    'entity_id', p_subject_id,
    'role', 'subject'
  )) || COALESCE(p_entities, '[]'::JSONB);

  FOR entity IN SELECT value FROM jsonb_array_elements(normalized_entities)
  LOOP
    linked_entity_type := entity->>'entity_type';
    linked_entity_id := NULLIF(entity->>'entity_id', '')::UUID;
    linked_role := COALESCE(NULLIF(entity->>'role', ''), 'related');
    link_name := COALESCE(
      NULLIF(entity->>'name', ''),
      public.domain_entity_display_name(linked_entity_type, linked_entity_id)
    );

    IF linked_entity_type IS NULL OR linked_entity_id IS NULL THEN
      RAISE EXCEPTION 'domain_event_entity_type_and_id_required';
    END IF;

    IF link_name IS NOT NULL THEN
      generic_name_key := linked_entity_type || '_name';
      -- The subject owns {type}_name. A reschedule's makeup session is also a
      -- session, and must not replace the missed class used by absence notices.
      IF linked_role = 'subject' OR NOT (generic_name_key = ANY(subject_name_keys)) THEN
        display_payload := display_payload || jsonb_build_object(generic_name_key, link_name);
      END IF;
      IF linked_role = 'subject' THEN
        subject_name_keys := array_append(subject_name_keys, generic_name_key);
      END IF;
    END IF;
  END LOOP;

  IF actor_id IS NOT NULL THEN
    link_name := public.domain_entity_display_name('staff', actor_id);
    IF link_name IS NOT NULL THEN
      display_payload := display_payload || jsonb_build_object('actor_name', link_name);
    END IF;
  END IF;

  INSERT INTO public.domain_events (
    event_name,
    subject_type,
    subject_id,
    payload,
    actor_staff_id,
    recorded_at,
    effective_at,
    correlation_id,
    idempotency_key,
    source,
    is_backfilled
  ) VALUES (
    p_event_name,
    p_subject_type,
    p_subject_id,
    COALESCE(p_payload, '{}'::JSONB) || jsonb_build_object('display', display_payload),
    actor_id,
    NOW(),
    COALESCE(p_effective_at, NOW()),
    p_correlation_id,
    NULLIF(BTRIM(p_idempotency_key), ''),
    COALESCE(NULLIF(BTRIM(p_source), ''), 'application'),
    COALESCE(NULLIF(BTRIM(p_source), ''), 'application') = 'legacy_backfill'
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO event_id;

  IF event_id IS NULL THEN
    SELECT id INTO event_id
    FROM public.domain_events
    WHERE idempotency_key = NULLIF(BTRIM(p_idempotency_key), '');
    RETURN event_id;
  END IF;
  inserted_event := TRUE;

  FOR entity IN SELECT value FROM jsonb_array_elements(normalized_entities)
  LOOP
    INSERT INTO public.domain_event_entities (
      domain_event_id,
      entity_type,
      entity_id,
      role
    ) VALUES (
      event_id,
      entity->>'entity_type',
      NULLIF(entity->>'entity_id', '')::UUID,
      COALESCE(NULLIF(entity->>'role', ''), 'related')
    )
    ON CONFLICT (domain_event_id, entity_type, entity_id) DO UPDATE
      SET role = CASE
        WHEN EXCLUDED.role = 'subject' THEN 'subject'
        ELSE public.domain_event_entities.role
      END;
  END LOOP;

  -- Enqueue in the same transaction as the domain event. The existing
  -- automation-execution dispatcher delivers due rows asynchronously, so an
  -- application write never waits on an Edge Function network call.
  IF inserted_event AND p_dispatch_automations THEN
    FOR rule_row IN
      SELECT id
      FROM public.automation_rules
      WHERE enabled = TRUE
        AND trigger_kind = 'EVENT'
        AND event_names @> ARRAY[p_event_name]
      ORDER BY priority DESC, created_at ASC
    LOOP
      INSERT INTO public.automation_executions (
        rule_id,
        domain_event_id,
        entity_type,
        entity_id,
        event_type,
        event_name,
        session_id,
        source_key,
        scheduled_for,
        next_attempt_at
      ) VALUES (
        rule_row.id,
        event_id,
        p_subject_type,
        p_subject_id,
        p_event_name,
        p_event_name,
        (
          SELECT NULLIF(value->>'entity_id', '')::UUID
          FROM jsonb_array_elements(normalized_entities)
          WHERE value->>'entity_type' = 'session'
          LIMIT 1
        ),
        'domain-event:' || event_id::TEXT || ':' || rule_row.id::TEXT,
        NOW(),
        NOW()
      )
      ON CONFLICT (source_key) DO NOTHING;
    END LOOP;
  END IF;

  RETURN event_id;
END;
$function$;

UPDATE public.domain_events AS event
SET payload = jsonb_set(
  event.payload,
  '{display,session_name}',
  to_jsonb(subject_link.display_name)
)
FROM public.domain_event_entities AS subject_link
WHERE subject_link.domain_event_id = event.id
  AND subject_link.entity_type = 'session'
  AND subject_link.role = 'subject'
  AND event.event_name = 'session.student_rescheduled'
  AND NULLIF(BTRIM(subject_link.display_name), '') IS NOT NULL
  AND event.payload #>> '{display,session_name}' IS DISTINCT FROM subject_link.display_name;

UPDATE public.notifications AS notification
SET
  body = subject_link.display_name,
  updated_at = NOW()
FROM public.domain_events AS event
JOIN public.domain_event_entities AS subject_link
  ON subject_link.domain_event_id = event.id
 AND subject_link.entity_type = 'session'
 AND subject_link.role = 'subject'
WHERE notification.domain_event_id = event.id
  AND event.event_name = 'session.student_rescheduled'
  AND notification.notification_type IN (
    'SESSION_STUDENT_ABSENCE_LOGGED',
    'STUDENT_ABSENCE_LOGGED'
  )
  AND NULLIF(BTRIM(subject_link.display_name), '') IS NOT NULL
  AND notification.body IS DISTINCT FROM subject_link.display_name;
