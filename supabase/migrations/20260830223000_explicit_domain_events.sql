-- Explicit lifecycle events for AdminWeb activity feeds and automation.
--
-- This is a clean cutover for core admin entities:
--   * generic row-change triggers are removed;
--   * recognized history is backfilled without automation dispatch;
--   * enabled rules with actions keep their IDs and move to event names;
--   * the legacy ledger remains only for historical/unrelated content-audit writers.

-- ---------------------------------------------------------------------------
-- 1. Stop generic core-table logging and preserve the old rows for one release.
-- ---------------------------------------------------------------------------

DO $block$
DECLARE
  trigger_row RECORD;
BEGIN
  FOR trigger_row IN
    SELECT namespace.nspname, relation.relname, trigger.tgname
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND NOT trigger.tgisinternal
      AND trigger.tgname LIKE 'trigger_activity_events_%'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I.%I',
      trigger_row.tgname,
      trigger_row.nspname,
      trigger_row.relname
    );
  END LOOP;
END;
$block$;

DROP FUNCTION IF EXISTS public.create_activity_event();

-- Class enrollment materializes Session participation, but that implementation
-- detail must not become hundreds of Session lifecycle events. Staff syncing
-- already carries an equivalent marker; add the Student marker here.
CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  sessions_affected INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_student_assignment_source', TRUE);
BEGIN
  PERFORM set_config('app.sessions_student_assignment_source', 'class_student_sync', TRUE);
  BEGIN
    INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
    SELECT gen_random_uuid(), session.id, NEW.student_id, NEW.enrolled_by
    FROM public.sessions session
    WHERE session.class_id = NEW.class_id
      AND session.start_at >= NEW.enrolled_at
    ON CONFLICT (session_id, student_id) DO NOTHING;
    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
    RAISE;
  END;
  PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
  RAISE NOTICE 'Enrolled student % in % sessions starting from %', NEW.student_id, sessions_affected, NEW.enrolled_at;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_enrollment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  sessions_removed INTEGER := 0;
  sessions_added INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_student_assignment_source', TRUE);
BEGIN
  IF OLD.enrolled_at IS DISTINCT FROM NEW.enrolled_at THEN
    PERFORM set_config('app.sessions_student_assignment_source', 'class_student_sync', TRUE);
    BEGIN
      DELETE FROM public.sessions_students assignment
      USING public.sessions session
      WHERE assignment.session_id = session.id
        AND assignment.student_id = NEW.student_id
        AND session.class_id = NEW.class_id
        AND session.start_at < NEW.enrolled_at
        AND session.start_at >= OLD.enrolled_at
        AND session.start_at >= NOW();
      GET DIAGNOSTICS sessions_removed = ROW_COUNT;

      INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
      SELECT gen_random_uuid(), session.id, NEW.student_id, NEW.enrolled_by
      FROM public.sessions session
      WHERE session.class_id = NEW.class_id
        AND session.start_at >= NEW.enrolled_at
        AND session.start_at < OLD.enrolled_at
        AND session.start_at >= NOW()
      ON CONFLICT (session_id, student_id) DO NOTHING;
      GET DIAGNOSTICS sessions_added = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
      RAISE;
    END;
    PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
    RAISE NOTICE 'Enrollment date updated: removed from % sessions, added to % sessions', sessions_removed, sessions_added;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_unenrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  sessions_affected INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_student_assignment_source', TRUE);
BEGIN
  IF OLD.unenrolled_at IS NULL AND NEW.unenrolled_at IS NOT NULL THEN
    PERFORM set_config('app.sessions_student_assignment_source', 'class_student_sync', TRUE);
    BEGIN
      DELETE FROM public.sessions_students assignment
      USING public.sessions session
      WHERE assignment.session_id = session.id
        AND assignment.student_id = NEW.student_id
        AND session.class_id = NEW.class_id
        AND session.start_at >= NEW.unenrolled_at;
      GET DIAGNOSTICS sessions_affected = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
      RAISE;
    END;
    PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
    RAISE NOTICE 'Removed student % from % sessions starting from %', NEW.student_id, sessions_affected, NEW.unenrolled_at;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.activity_events RENAME TO activity_events_legacy;

-- A small number of non-feed security/content-audit functions insert into the
-- old ledger with SQL that is parsed only when the function runs. Point those
-- technical writers at the renamed table so they remain operational without
-- participating in lifecycle feeds or automation matching.
DO $block$
DECLARE
  function_row RECORD;
BEGIN
  FOR function_row IN
    SELECT procedure.oid
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prokind = 'f'
      AND pg_get_functiondef(procedure.oid) LIKE '%public.activity_events%'
  LOOP
    EXECUTE replace(
      pg_get_functiondef(function_row.oid),
      'public.activity_events',
      'public.activity_events_legacy'
    );
  END LOOP;
END;
$block$;

REVOKE INSERT, UPDATE, DELETE ON public.activity_events_legacy
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.activity_events_legacy IS
  'Pre-cutover row-change ledger. Not used by AdminWeb feeds or event automations; retained temporarily for historical and unrelated content-audit compatibility.';

-- The generic trigger implementations no longer have callers. Remove the old
-- recording surface so new code cannot accidentally revive row-change events.
DO $block$
DECLARE
  function_row RECORD;
BEGIN
  FOR function_row IN
    SELECT procedure.oid::REGPROCEDURE AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND (
        procedure.proname = 'log_activity_event'
        OR procedure.proname LIKE 'extract_activity_fks_%'
      )
    ORDER BY CASE WHEN procedure.proname LIKE 'extract_activity_fks_%' THEN 0 ELSE 1 END
  LOOP
    EXECUTE format('DROP FUNCTION %s', function_row.signature);
  END LOOP;
END;
$block$;

-- ---------------------------------------------------------------------------
-- 2. Immutable event store and direct entity links.
-- ---------------------------------------------------------------------------

CREATE TABLE public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_version SMALLINT NOT NULL DEFAULT 1 CHECK (event_version > 0),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(payload) = 'object'),
  actor_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  idempotency_key TEXT,
  source TEXT NOT NULL DEFAULT 'application',
  is_backfilled BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT domain_events_name_format_check CHECK (
    event_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
  ),
  CONSTRAINT domain_events_subject_type_check CHECK (
    subject_type IN (
      'student', 'parent', 'staff', 'class', 'admin_shift', 'session',
      'invoice', 'task', 'issue', 'project', 'note', 'form_response'
    )
  ),
  CONSTRAINT domain_events_idempotency_key_check CHECK (
    idempotency_key IS NULL OR BTRIM(idempotency_key) <> ''
  )
);

CREATE UNIQUE INDEX domain_events_idempotency_key_idx
  ON public.domain_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX domain_events_recorded_at_idx
  ON public.domain_events (recorded_at DESC, id DESC);

CREATE INDEX domain_events_effective_at_idx
  ON public.domain_events (effective_at DESC, id DESC);

CREATE INDEX domain_events_name_recorded_at_idx
  ON public.domain_events (event_name, recorded_at DESC);

CREATE INDEX domain_events_actor_recorded_at_idx
  ON public.domain_events (actor_staff_id, recorded_at DESC)
  WHERE actor_staff_id IS NOT NULL;

CREATE TABLE public.domain_event_entities (
  domain_event_id UUID NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'related' CHECK (BTRIM(role) <> ''),
  PRIMARY KEY (domain_event_id, entity_type, entity_id),
  CONSTRAINT domain_event_entities_type_check CHECK (
    entity_type IN (
      'student', 'parent', 'staff', 'class', 'admin_shift', 'session',
      'invoice', 'task', 'issue', 'project', 'note', 'form_response'
    )
  )
);

CREATE INDEX domain_event_entities_feed_idx
  ON public.domain_event_entities (entity_type, entity_id, domain_event_id);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_entities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.domain_events, public.domain_event_entities
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.domain_events, public.domain_event_entities
  TO authenticated;
GRANT ALL ON public.domain_events, public.domain_event_entities
  TO service_role;

CREATE POLICY "ADMINSTAFF can read domain events"
  ON public.domain_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF can read domain event entities"
  ON public.domain_event_entities
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

COMMENT ON TABLE public.domain_events IS
  'Immutable business lifecycle events used by AdminWeb activity feeds and event-driven automation. This is not a complete row audit log or an event-sourced write model.';
COMMENT ON TABLE public.domain_event_entities IS
  'Direct links from one lifecycle event to every core entity whose feed should display it. Actors are not implicitly feed-linked.';
COMMENT ON COLUMN public.domain_events.recorded_at IS
  'When Altitutor recorded the event.';
COMMENT ON COLUMN public.domain_events.effective_at IS
  'When the lifecycle outcome occurred; may predate recorded_at for logged sessions and attendance.';

-- A security-invoker feed projection keeps the application query shallow while
-- preserving RLS on both underlying tables.
CREATE VIEW public.vadmin_domain_event_feed
WITH (security_invoker = TRUE)
AS
SELECT
  event.id,
  event.event_name,
  event.event_version,
  event.subject_type,
  event.subject_id,
  event.payload,
  event.actor_staff_id,
  event.recorded_at,
  event.effective_at,
  event.correlation_id,
  event.source,
  event.is_backfilled,
  link.entity_type AS linked_entity_type,
  link.entity_id AS linked_entity_id,
  link.role AS linked_entity_role
FROM public.domain_event_entities link
JOIN public.domain_events event ON event.id = link.domain_event_id;

REVOKE ALL ON public.vadmin_domain_event_feed FROM PUBLIC, anon;
GRANT SELECT ON public.vadmin_domain_event_feed TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Retarget durable automation executions and production rules.
-- ---------------------------------------------------------------------------

ALTER TABLE public.automation_rules
  ADD COLUMN event_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.automation_executions
  ADD COLUMN domain_event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL,
  ADD COLUMN event_name TEXT;

CREATE INDEX automation_executions_domain_event_idx
  ON public.automation_executions (domain_event_id)
  WHERE domain_event_id IS NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN domain_event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL;

CREATE INDEX notifications_domain_event_idx
  ON public.notifications (domain_event_id)
  WHERE domain_event_id IS NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN source_domain_event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL;

CREATE INDEX tasks_source_domain_event_idx
  ON public.tasks (source_domain_event_id)
  WHERE source_domain_event_id IS NOT NULL;

-- Disabled rules do not need migration. An enabled rule without actions has no
-- behavior to preserve and was explicitly approved for removal.
DELETE FROM public.automation_rules rule
WHERE rule.enabled = FALSE
   OR NOT EXISTS (
     SELECT 1 FROM public.automation_actions action WHERE action.rule_id = rule.id
   );

UPDATE public.automation_rules
SET event_names = CASE name
  WHEN 'Confirm trial or subsidy session attendance' THEN ARRAY['session.student_added']
  WHEN 'Send registration after attended trial or subsidy' THEN ARRAY['session.logged']
  WHEN 'Notify trial or subsidy schedule changes' THEN ARRAY['session.schedule_updated']
  WHEN 'Thank student and parents after successful registration' THEN ARRAY['student.registered']
  WHEN 'Notify admin staff on new student registration' THEN ARRAY['student.registered']
  WHEN 'Notify admins of new trial sessions' THEN ARRAY['session.created']
  WHEN 'Notify student when an absence is logged' THEN ARRAY['session.student_absence_recorded']
  WHEN 'Notify session staff when a student absence is logged' THEN ARRAY['session.student_absence_recorded']
  WHEN 'Notify staff when directly removed from a session' THEN ARRAY['session.staff_removed']
  WHEN 'Notify staff when removed from a class' THEN ARRAY['class.staff_removed']
  WHEN 'Notify staff when assigned to a class' THEN ARRAY['class.staff_added']
  WHEN 'Notify staff when directly assigned to a session' THEN ARRAY['session.staff_added']
  ELSE event_names
END
WHERE trigger_kind = 'EVENT';

-- The lifecycle event itself now carries the transition that these old
-- changed-column conditions attempted to reconstruct.
UPDATE public.automation_rules
SET conditions = CASE name
  WHEN 'Notify trial or subsidy schedule changes' THEN jsonb_build_object(
    'all', jsonb_build_array(
      jsonb_build_object('field', 'session.type', 'operator', 'in', 'value', jsonb_build_array('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')),
      jsonb_build_object('field', 'session.status', 'operator', 'equals', 'value', 'ACTIVE')
    )
  )
  WHEN 'Thank student and parents after successful registration' THEN NULL
  WHEN 'Notify admin staff on new student registration' THEN NULL
  WHEN 'Notify student when an absence is logged' THEN NULL
  WHEN 'Notify session staff when a student absence is logged' THEN NULL
  WHEN 'Notify staff when directly removed from a session' THEN NULL
  WHEN 'Notify staff when removed from a class' THEN NULL
  WHEN 'Notify staff when directly assigned to a session' THEN NULL
  ELSE conditions
END
WHERE trigger_kind = 'EVENT';

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.automation_rules
    WHERE trigger_kind = 'EVENT'
      AND cardinality(event_names) = 0
  ) THEN
    RAISE EXCEPTION 'Every retained EVENT automation rule must map to a lifecycle event name';
  END IF;
END;
$block$;

ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_event_names_check CHECK (
    (trigger_kind = 'EVENT' AND cardinality(event_names) > 0)
    OR (trigger_kind = 'RELATIVE_TIME' AND cardinality(event_names) = 0)
  );

CREATE INDEX automation_rules_event_names_idx
  ON public.automation_rules USING GIN (event_names)
  WHERE trigger_kind = 'EVENT' AND enabled = TRUE;

ALTER TABLE public.automation_rules DROP COLUMN event_types;

-- ---------------------------------------------------------------------------
-- 4. One transactional recording interface.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.domain_entity_display_name(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  display_name TEXT;
BEGIN
  CASE p_entity_type
    WHEN 'student' THEN
      SELECT BTRIM(CONCAT_WS(' ', first_name, last_name)) INTO display_name
      FROM public.students WHERE id = p_entity_id;
    WHEN 'parent' THEN
      SELECT BTRIM(CONCAT_WS(' ', first_name, last_name)) INTO display_name
      FROM public.parents WHERE id = p_entity_id;
    WHEN 'staff' THEN
      SELECT BTRIM(CONCAT_WS(' ', first_name, last_name)) INTO display_name
      FROM public.staff WHERE id = p_entity_id;
    WHEN 'class' THEN
      SELECT COALESCE(NULLIF(BTRIM(long_name), ''), NULLIF(BTRIM(short_name), ''))
      INTO display_name FROM public.classes WHERE id = p_entity_id;
    WHEN 'session' THEN
      SELECT COALESCE(NULLIF(BTRIM(long_name), ''), NULLIF(BTRIM(short_name), ''))
      INTO display_name FROM public.sessions WHERE id = p_entity_id;
    WHEN 'task' THEN
      SELECT title INTO display_name FROM public.tasks WHERE id = p_entity_id;
    WHEN 'issue' THEN
      SELECT name INTO display_name FROM public.issues WHERE id = p_entity_id;
    WHEN 'project' THEN
      SELECT name INTO display_name FROM public.projects WHERE id = p_entity_id;
    WHEN 'invoice' THEN
      SELECT COALESCE(stripe_invoice_number, id::TEXT) INTO display_name
      FROM public.invoices WHERE id = p_entity_id;
    ELSE
      display_name := NULL;
  END CASE;

  RETURN NULLIF(BTRIM(display_name), '');
END;
$function$;

REVOKE ALL ON FUNCTION public.domain_entity_display_name(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.domain_entity_display_name(TEXT, UUID)
  TO service_role, postgres;

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
  link_name TEXT;
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
    link_name := COALESCE(
      NULLIF(entity->>'name', ''),
      public.domain_entity_display_name(linked_entity_type, linked_entity_id)
    );

    IF linked_entity_type IS NULL OR linked_entity_id IS NULL THEN
      RAISE EXCEPTION 'domain_event_entity_type_and_id_required';
    END IF;

    IF link_name IS NOT NULL THEN
      display_payload := display_payload || jsonb_build_object(
        linked_entity_type || '_name',
        link_name
      );
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

REVOKE ALL ON FUNCTION public.record_domain_event(
  TEXT, TEXT, UUID, JSONB, JSONB, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_domain_event(
  TEXT, TEXT, UUID, JSONB, JSONB, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, BOOLEAN
) TO service_role, postgres;

COMMENT ON FUNCTION public.record_domain_event(
  TEXT, TEXT, UUID, JSONB, JSONB, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, BOOLEAN
) IS
  'Transactional seam for immutable lifecycle events, direct feed links, display snapshots, idempotency, and durable automation enqueueing.';

CREATE OR REPLACE FUNCTION public.domain_event_entity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_role TEXT DEFAULT 'related',
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'role', p_role,
    'name', p_name
  ));
$function$;

REVOKE ALL ON FUNCTION public.domain_event_entity(TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.domain_event_entity(TEXT, UUID, TEXT, TEXT)
  TO service_role, postgres;

-- ---------------------------------------------------------------------------
-- 5. Best-effort history migration. These rows can never enqueue automation.
-- ---------------------------------------------------------------------------

WITH recognized AS (
  SELECT
    legacy.*,
    CASE
      WHEN entity_type = 'students' AND event_type = 'CREATED'
        THEN 'student.created'
      WHEN entity_type = 'students' AND event_type = 'UPDATED'
        AND (changed_fields ? 'registered_at'
          OR changed_fields->'status'->>'new' = 'ACTIVE'
             AND changed_fields->'status'->>'old' = 'TRIAL')
        THEN 'student.registered'
      WHEN entity_type = 'students' AND event_type = 'UPDATED'
        AND changed_fields ? 'user_id'
        AND changed_fields->'user_id'->'old' = 'null'::JSONB
        AND changed_fields->'user_id'->'new' <> 'null'::JSONB
        THEN 'student.user_account_created'
      WHEN entity_type = 'students' AND event_type = 'UPDATED'
        AND changed_fields->'status'->>'new' = 'DISCONTINUED'
        THEN 'student.discontinued'
      WHEN entity_type = 'students' AND event_type = 'UPDATED'
        AND changed_fields->'status'->>'old' = 'DISCONTINUED'
        AND changed_fields->'status'->>'new' IS DISTINCT FROM 'DISCONTINUED'
        THEN 'student.reactivated'
      WHEN entity_type = 'staff' AND event_type = 'CREATED'
        THEN 'staff.created'
      WHEN entity_type = 'staff' AND event_type = 'UPDATED' AND changed_fields ? 'user_id'
        THEN 'staff.user_account_created'
      WHEN entity_type = 'staff' AND event_type = 'UPDATED' AND changed_fields ? 'status'
        THEN 'staff.status_changed'
      WHEN entity_type = 'classes' AND event_type = 'CREATED'
        THEN 'class.created'
      WHEN entity_type = 'classes' AND event_type = 'UPDATED'
        AND changed_fields ?| ARRAY[
          'day_of_week', 'start_time', 'end_time', 'session_start_date',
          'session_end_date', 'schedule_timezone', 'schedule_rows',
          'schedule_weekdays', 'schedule_frequency_weeks', 'schedule_anchor_date'
        ]
        THEN 'class.schedule_updated'
      WHEN entity_type = 'classes_students' AND event_type = 'CREATED'
        THEN 'class.student_added'
      WHEN entity_type = 'classes_students'
        AND (event_type = 'DELETED' OR changed_fields ? 'unenrolled_at')
        THEN 'class.student_removed'
      WHEN entity_type = 'classes_staff' AND event_type = 'CREATED'
        THEN 'class.staff_added'
      WHEN entity_type = 'classes_staff'
        AND (event_type = 'DELETED' OR changed_fields ? 'unassigned_at')
        THEN 'class.staff_removed'
      WHEN entity_type = 'sessions' AND event_type = 'CREATED'
        THEN 'session.created'
      WHEN entity_type = 'sessions' AND event_type = 'UPDATED'
        AND changed_fields ?| ARRAY['start_at', 'end_at']
        THEN 'session.schedule_updated'
      WHEN entity_type = 'sessions_students' AND event_type = 'CREATED'
        THEN 'session.student_added'
      WHEN entity_type = 'sessions_students' AND event_type = 'DELETED'
        THEN 'session.student_removed'
      WHEN entity_type = 'sessions_students' AND event_type = 'UPDATED'
        AND changed_fields->'planned_absence'->>'new' = 'true'
        THEN 'session.student_absence_recorded'
      WHEN entity_type = 'sessions_students' AND event_type = 'UPDATED'
        AND changed_fields->'planned_absence'->>'new' = 'false'
        THEN 'session.student_absence_cleared'
      WHEN entity_type = 'sessions_staff' AND event_type = 'CREATED'
        AND metadata->>'assignment_source' IS DISTINCT FROM 'class_staff_sync'
        THEN 'session.staff_added'
      WHEN entity_type = 'sessions_staff' AND event_type = 'DELETED'
        AND metadata->>'assignment_source' IS DISTINCT FROM 'class_staff_sync'
        THEN 'session.staff_removed'
      WHEN entity_type = 'tutor_logs' AND event_type = 'CREATED'
        THEN 'session.logged'
      WHEN entity_type = 'tutor_logs_student_attendance' AND event_type IN ('CREATED', 'UPDATED')
        AND COALESCE(changed_fields->'attended'->>'new', metadata->>'attended') = 'true'
        THEN 'session.student_attended'
      WHEN entity_type = 'tutor_logs_student_attendance' AND event_type IN ('CREATED', 'UPDATED')
        THEN 'session.student_absent'
      WHEN entity_type = 'tutor_logs_staff_attendance' AND event_type IN ('CREATED', 'UPDATED')
        AND COALESCE(changed_fields->'attended'->>'new', metadata->>'attended') = 'true'
        THEN 'session.staff_attended'
      WHEN entity_type = 'tutor_logs_staff_attendance' AND event_type IN ('CREATED', 'UPDATED')
        THEN 'session.staff_absent'
      WHEN entity_type = 'parents_students' AND event_type = 'CREATED'
        THEN 'student.parent_linked'
      WHEN entity_type = 'parents_students' AND event_type = 'DELETED'
        THEN 'student.parent_unlinked'
      WHEN entity_type = 'invoices' AND event_type = 'CREATED'
        THEN 'invoice.issued'
      WHEN entity_type = 'invoices' AND event_type = 'UPDATED'
        AND (changed_fields ? 'paid_at' OR changed_fields->'status'->>'new' = 'paid')
        THEN 'invoice.paid'
      WHEN entity_type = 'tasks' AND event_type = 'CREATED'
        THEN 'task.created'
      WHEN entity_type = 'tasks' AND event_type = 'UPDATED' AND changed_fields ? 'status'
        THEN 'task.status_changed'
      WHEN entity_type = 'tasks' AND event_type = 'UPDATED' AND changed_fields ? 'assigned_to'
        THEN 'task.assignee_changed'
      WHEN entity_type = 'tasks' AND event_type = 'UPDATED'
        THEN 'task.properties_changed'
      WHEN entity_type = 'tasks' AND event_type = 'DELETED'
        THEN 'task.deleted'
      WHEN entity_type = 'issues' AND event_type = 'CREATED'
        THEN 'issue.created'
      WHEN entity_type = 'issues' AND event_type = 'UPDATED' AND changed_fields ? 'status'
        THEN 'issue.status_changed'
      WHEN entity_type = 'issues' AND event_type = 'UPDATED'
        THEN 'issue.properties_changed'
      WHEN entity_type = 'issues' AND event_type = 'DELETED'
        THEN 'issue.deleted'
      WHEN entity_type = 'projects' AND event_type = 'CREATED'
        THEN 'project.created'
      WHEN entity_type = 'projects' AND event_type = 'UPDATED' AND changed_fields ? 'status'
        THEN 'project.status_changed'
      WHEN entity_type = 'projects' AND event_type = 'UPDATED'
        THEN 'project.properties_changed'
      WHEN entity_type = 'projects' AND event_type = 'DELETED'
        THEN 'project.deleted'
      WHEN entity_type = 'notes' AND event_type = 'CREATED'
        THEN 'note.added'
      WHEN entity_type = 'notes' AND event_type = 'DELETED'
        THEN 'note.removed'
      WHEN entity_type = 'sessions_files' AND event_type = 'CREATED'
        THEN 'session.file_added'
      WHEN entity_type = 'sessions_files' AND event_type = 'DELETED'
        THEN 'session.file_removed'
      WHEN entity_type = 'form_responses' AND event_type = 'CREATED'
        THEN 'form.response_submitted'
      WHEN entity_type = 'form_responses' AND event_type = 'DELETED'
        THEN 'form.response_removed'
      WHEN entity_type = 'admin_shifts' AND event_type = 'CREATED'
        THEN 'admin_shift.created'
      WHEN entity_type = 'admin_shifts' AND event_type = 'UPDATED'
        THEN 'admin_shift.schedule_updated'
      WHEN entity_type = 'admin_shifts_staff' AND event_type = 'CREATED'
        THEN 'admin_shift.staff_added'
      WHEN entity_type = 'admin_shifts_staff'
        AND (event_type = 'DELETED' OR changed_fields ? 'unassigned_at')
        THEN 'admin_shift.staff_removed'
      ELSE NULL
    END AS lifecycle_name
  FROM public.activity_events_legacy legacy
), shaped AS (
  SELECT
    id,
    lifecycle_name,
    CASE
      WHEN lifecycle_name LIKE 'student.%' THEN 'student'
      WHEN lifecycle_name LIKE 'staff.%' THEN 'staff'
      WHEN lifecycle_name LIKE 'class.%' THEN 'class'
      WHEN lifecycle_name LIKE 'session.%' THEN 'session'
      WHEN lifecycle_name LIKE 'invoice.%' THEN 'invoice'
      WHEN lifecycle_name LIKE 'task.%' THEN 'task'
      WHEN lifecycle_name LIKE 'issue.%' THEN 'issue'
      WHEN lifecycle_name LIKE 'project.%' THEN 'project'
      WHEN lifecycle_name LIKE 'note.%' THEN 'note'
      WHEN lifecycle_name LIKE 'form.%' THEN 'form_response'
      WHEN lifecycle_name LIKE 'admin_shift.%' THEN 'admin_shift'
    END AS subject_type,
    CASE
      WHEN lifecycle_name LIKE 'student.%' THEN COALESCE(student_id, CASE WHEN entity_type = 'students' THEN entity_id END)
      WHEN lifecycle_name LIKE 'staff.%' THEN COALESCE(staff_id, CASE WHEN entity_type = 'staff' THEN entity_id END)
      WHEN lifecycle_name LIKE 'class.%' THEN COALESCE(class_id, CASE WHEN entity_type = 'classes' THEN entity_id END)
      WHEN lifecycle_name LIKE 'session.%' THEN COALESCE(session_id, CASE WHEN entity_type = 'sessions' THEN entity_id END)
      WHEN lifecycle_name LIKE 'invoice.%' THEN CASE WHEN entity_type = 'invoices' THEN entity_id END
      WHEN lifecycle_name LIKE 'task.%' THEN COALESCE(task_id, CASE WHEN entity_type = 'tasks' THEN entity_id END)
      WHEN lifecycle_name LIKE 'issue.%' THEN COALESCE(issue_id, CASE WHEN entity_type = 'issues' THEN entity_id END)
      WHEN lifecycle_name LIKE 'project.%' THEN COALESCE(project_id, CASE WHEN entity_type = 'projects' THEN entity_id END)
      WHEN lifecycle_name LIKE 'note.%' THEN entity_id
      WHEN lifecycle_name LIKE 'form.%' THEN entity_id
      WHEN lifecycle_name LIKE 'admin_shift.%' THEN COALESCE(
        NULLIF(metadata->>'admin_shift_id', '')::UUID,
        CASE WHEN entity_type = 'admin_shifts' THEN entity_id END
      )
    END AS subject_id,
    jsonb_strip_nulls(jsonb_build_object(
      'changes', changed_fields,
      'legacy_metadata', metadata,
      'display', metadata->'display'
    )) AS payload,
    performed_by,
    performed_at,
    student_id,
    staff_id,
    class_id,
    session_id,
    task_id,
    parent_id,
    issue_id,
    project_id
  FROM recognized
  WHERE lifecycle_name IS NOT NULL
)
INSERT INTO public.domain_events (
  id,
  event_name,
  subject_type,
  subject_id,
  payload,
  actor_staff_id,
  recorded_at,
  effective_at,
  idempotency_key,
  source,
  is_backfilled
)
SELECT
  id,
  lifecycle_name,
  subject_type,
  subject_id,
  payload,
  performed_by,
  performed_at,
  performed_at,
  'legacy:' || id::TEXT,
  'legacy_backfill',
  TRUE
FROM shaped
WHERE subject_type IS NOT NULL
  AND subject_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, event.subject_type, event.subject_id, 'subject'
FROM public.domain_events event
WHERE event.source = 'legacy_backfill'
ON CONFLICT DO NOTHING;

INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT DISTINCT event.id, related.entity_type, related.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
CROSS JOIN LATERAL (
  VALUES
    ('student'::TEXT, legacy.student_id),
    ('parent'::TEXT, legacy.parent_id),
    ('staff'::TEXT, legacy.staff_id),
    ('class'::TEXT, legacy.class_id),
    ('session'::TEXT, legacy.session_id),
    ('task'::TEXT, legacy.task_id),
    ('issue'::TEXT, legacy.issue_id),
    ('project'::TEXT, legacy.project_id),
    ('invoice'::TEXT, CASE WHEN legacy.entity_type = 'invoices' THEN legacy.entity_id END),
    ('note'::TEXT, CASE WHEN legacy.entity_type = 'notes' THEN legacy.entity_id END),
    ('form_response'::TEXT, CASE WHEN legacy.entity_type = 'form_responses' THEN legacy.entity_id END)
) AS related(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND related.entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Explicit lifecycle capture. One implementation replaces the former
--    table-per-trigger row serializers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capture_core_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
<<capture>>
DECLARE
  old_row JSONB := '{}'::JSONB;
  new_row JSONB := '{}'::JSONB;
  row_id UUID;
  actor_id UUID;
  student_id UUID;
  parent_id UUID;
  staff_id UUID;
  class_id UUID;
  session_id UUID;
  invoice_id UUID;
  task_id UUID;
  issue_id UUID;
  project_id UUID;
  shift_id UUID;
  tutor_log_id UUID;
  effective_at TIMESTAMPTZ := NOW();
  entities JSONB := '[]'::JSONB;
  payload JSONB := '{}'::JSONB;
  source_name TEXT;
  session_row RECORD;
  credit_note_type TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_id := COALESCE(NULLIF(new_row->>'id', '')::UUID, NULLIF(old_row->>'id', '')::UUID);
  actor_id := COALESCE(
    public.current_staff_id(),
    NULLIF(new_row->>'created_by', '')::UUID,
    NULLIF(new_row->>'recorded_by_staff_id', '')::UUID,
    NULLIF(new_row->>'enrolled_by', '')::UUID,
    NULLIF(new_row->>'assigned_by', '')::UUID,
    NULLIF(new_row->>'planned_absence_logged_by', '')::UUID,
    NULLIF(new_row->>'credited_by', '')::UUID,
    NULLIF(new_row->>'deleted_by', '')::UUID,
    NULLIF(old_row->>'created_by', '')::UUID,
    NULLIF(old_row->>'unenrolled_by', '')::UUID,
    NULLIF(old_row->>'unassigned_by', '')::UUID
  );

  -- Student lifecycle --------------------------------------------------------
  IF TG_TABLE_NAME = 'students' THEN
    student_id := row_id;
    entities := jsonb_build_array(public.domain_event_entity(
      'student', student_id, 'subject',
      BTRIM(CONCAT_WS(' ', COALESCE(new_row->>'first_name', old_row->>'first_name'), COALESCE(new_row->>'last_name', old_row->>'last_name')))
    ));

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'student.created', 'student', student_id, entities,
        jsonb_build_object('status', new_row->'status'),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'student:' || student_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF (
        old_row->'registered_at' = 'null'::JSONB
        AND new_row->'registered_at' <> 'null'::JSONB
      ) OR (
        old_row->>'status' = 'TRIAL' AND new_row->>'status' = 'ACTIVE'
      ) THEN
        PERFORM public.record_domain_event(
          'student.registered', 'student', student_id, entities,
          jsonb_build_object(
            'actor_type', CASE WHEN actor_id IS NULL THEN 'student' ELSE 'staff' END,
            'status', new_row->'status'
          ),
          COALESCE(NULLIF(new_row->>'registered_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'student:' || student_id::TEXT || ':registered'
        );
      END IF;

      IF old_row->'user_id' = 'null'::JSONB AND new_row->'user_id' <> 'null'::JSONB THEN
        PERFORM public.record_domain_event(
          'student.user_account_created', 'student', student_id, entities,
          jsonb_build_object('actor_type', CASE WHEN actor_id IS NULL THEN 'student' ELSE 'staff' END),
          NOW(), actor_id, NULL, 'student:' || student_id::TEXT || ':user-account-created'
        );
      END IF;

      IF old_row->>'status' IS DISTINCT FROM new_row->>'status'
        AND new_row->>'status' = 'DISCONTINUED' THEN
        PERFORM public.record_domain_event(
          'student.discontinued', 'student', student_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          COALESCE(NULLIF(new_row->>'discontinued_at', '')::TIMESTAMPTZ, NOW()),
          COALESCE(NULLIF(new_row->>'discontinued_by', '')::UUID, actor_id)
        );
      ELSIF old_row->>'status' = 'DISCONTINUED'
        AND new_row->>'status' IS DISTINCT FROM 'DISCONTINUED' THEN
        PERFORM public.record_domain_event(
          'student.reactivated', 'student', student_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          NOW(), actor_id
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'student.deleted', 'student', student_id, entities,
        '{}'::JSONB, NOW(), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'student_payment_methods' THEN
    student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
    entities := jsonb_build_array(public.domain_event_entity('student', student_id, 'subject'));
    payload := jsonb_strip_nulls(jsonb_build_object(
      'card_brand', COALESCE(new_row->>'card_brand', old_row->>'card_brand'),
      'card_last4', COALESCE(new_row->>'card_last4', old_row->>'card_last4'),
      'card_exp_month', COALESCE(new_row->'card_exp_month', old_row->'card_exp_month'),
      'card_exp_year', COALESCE(new_row->'card_exp_year', old_row->'card_exp_year'),
      'is_default', COALESCE(new_row->'is_default', old_row->'is_default')
    ));

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'student.payment_method_added', 'student', student_id, entities, payload,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'payment-method:' || row_id::TEXT || ':added', 'stripe'
      );
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'student.payment_method_removed', 'student', student_id, entities, payload,
        NOW(), actor_id, NULL, 'payment-method:' || row_id::TEXT || ':removed', 'stripe'
      );
    END IF;

  -- Staff lifecycle ----------------------------------------------------------
  ELSIF TG_TABLE_NAME = 'staff' THEN
    staff_id := row_id;
    entities := jsonb_build_array(public.domain_event_entity(
      'staff', staff_id, 'subject',
      BTRIM(CONCAT_WS(' ', COALESCE(new_row->>'first_name', old_row->>'first_name'), COALESCE(new_row->>'last_name', old_row->>'last_name')))
    ));

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'staff.created', 'staff', staff_id, entities,
        jsonb_build_object('status', new_row->'status', 'role', new_row->'role'),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'staff:' || staff_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF old_row->'user_id' = 'null'::JSONB AND new_row->'user_id' <> 'null'::JSONB THEN
        PERFORM public.record_domain_event(
          'staff.user_account_created', 'staff', staff_id, entities,
          '{}'::JSONB, NOW(), actor_id, NULL,
          'staff:' || staff_id::TEXT || ':user-account-created'
        );
      END IF;
      IF old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN
        PERFORM public.record_domain_event(
          'staff.status_changed', 'staff', staff_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          NOW(), actor_id
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'staff.deleted', 'staff', staff_id, entities, '{}'::JSONB, NOW(), actor_id
      );
    END IF;

  -- Class and Admin-shift lifecycle -----------------------------------------
  ELSIF TG_TABLE_NAME = 'classes' THEN
    class_id := row_id;
    entities := jsonb_build_array(public.domain_event_entity(
      'class', class_id, 'subject',
      COALESCE(NULLIF(BTRIM(new_row->>'long_name'), ''), NULLIF(BTRIM(new_row->>'short_name'), ''), NULLIF(BTRIM(old_row->>'long_name'), ''), NULLIF(BTRIM(old_row->>'short_name'), ''))
    ));

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'class.created', 'class', class_id, entities,
        jsonb_build_object('status', new_row->'status'),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'class:' || class_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF (old_row - ARRAY['updated_at']) IS DISTINCT FROM (new_row - ARRAY['updated_at'])
        AND (
          old_row->'day_of_week' IS DISTINCT FROM new_row->'day_of_week'
          OR old_row->'start_time' IS DISTINCT FROM new_row->'start_time'
          OR old_row->'end_time' IS DISTINCT FROM new_row->'end_time'
          OR old_row->'session_start_date' IS DISTINCT FROM new_row->'session_start_date'
          OR old_row->'session_end_date' IS DISTINCT FROM new_row->'session_end_date'
          OR old_row->'schedule_timezone' IS DISTINCT FROM new_row->'schedule_timezone'
          OR old_row->'schedule_rows' IS DISTINCT FROM new_row->'schedule_rows'
          OR old_row->'schedule_weekdays' IS DISTINCT FROM new_row->'schedule_weekdays'
          OR old_row->'schedule_frequency_weeks' IS DISTINCT FROM new_row->'schedule_frequency_weeks'
          OR old_row->'schedule_anchor_date' IS DISTINCT FROM new_row->'schedule_anchor_date'
        ) THEN
        PERFORM public.record_domain_event(
          'class.schedule_updated', 'class', class_id, entities,
          jsonb_build_object('previous_schedule', jsonb_build_object(
            'day_of_week', old_row->'day_of_week', 'start_time', old_row->'start_time', 'end_time', old_row->'end_time',
            'start_date', old_row->'session_start_date', 'end_date', old_row->'session_end_date'
          ), 'schedule', jsonb_build_object(
            'day_of_week', new_row->'day_of_week', 'start_time', new_row->'start_time', 'end_time', new_row->'end_time',
            'start_date', new_row->'session_start_date', 'end_date', new_row->'session_end_date'
          )),
          NOW(), actor_id
        );
      END IF;
      IF old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN
        PERFORM public.record_domain_event(
          'class.status_changed', 'class', class_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          NOW(), actor_id
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'class.deleted', 'class', class_id, entities, '{}'::JSONB, NOW(), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'admin_shifts' THEN
    shift_id := row_id;
    entities := jsonb_build_array(public.domain_event_entity('admin_shift', shift_id, 'subject'));
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'admin_shift.created', 'admin_shift', shift_id, entities,
        jsonb_build_object(
          'day_of_week', new_row->'day_of_week', 'start_time', new_row->'start_time',
          'end_time', new_row->'end_time', 'status', new_row->'status'
        ),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'admin-shift:' || shift_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF old_row->'day_of_week' IS DISTINCT FROM new_row->'day_of_week'
        OR old_row->'start_time' IS DISTINCT FROM new_row->'start_time'
        OR old_row->'end_time' IS DISTINCT FROM new_row->'end_time'
        OR old_row->'session_start_date' IS DISTINCT FROM new_row->'session_start_date'
        OR old_row->'session_end_date' IS DISTINCT FROM new_row->'session_end_date' THEN
        PERFORM public.record_domain_event(
          'admin_shift.schedule_updated', 'admin_shift', shift_id, entities,
          jsonb_build_object('previous', old_row, 'current', new_row),
          NOW(), actor_id
        );
      END IF;
      IF old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN
        PERFORM public.record_domain_event(
          'admin_shift.status_changed', 'admin_shift', shift_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          NOW(), actor_id
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'admin_shift.deleted', 'admin_shift', shift_id, entities, '{}'::JSONB, NOW(), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'classes_students' THEN
    student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
    class_id := COALESCE(NULLIF(new_row->>'class_id', '')::UUID, NULLIF(old_row->>'class_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('class', class_id, 'subject'),
      public.domain_event_entity('student', student_id, 'related')
    );

    IF TG_OP = 'INSERT' AND new_row->'unenrolled_at' = 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'class.student_added', 'class', class_id, entities,
        jsonb_build_object('enrolled_at', new_row->'enrolled_at'),
        COALESCE(NULLIF(new_row->>'enrolled_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'enrolled_by', '')::UUID, actor_id),
        NULL,
        'class-student:' || row_id::TEXT || ':added:' || COALESCE(new_row->>'enrolled_at', 'unknown')
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'unenrolled_at' = 'null'::JSONB
      AND new_row->'unenrolled_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'class.student_removed', 'class', class_id, entities,
        jsonb_build_object('unenrolled_at', new_row->'unenrolled_at'),
        COALESCE(NULLIF(new_row->>'unenrolled_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'unenrolled_by', '')::UUID, actor_id),
        NULL,
        'class-student:' || row_id::TEXT || ':removed:' || COALESCE(new_row->>'unenrolled_at', 'unknown')
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'unenrolled_at' <> 'null'::JSONB
      AND new_row->'unenrolled_at' = 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'class.student_added', 'class', class_id, entities,
        jsonb_build_object('enrolled_at', new_row->'enrolled_at', 'reactivated', TRUE),
        COALESCE(NULLIF(new_row->>'enrolled_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'enrolled_by', '')::UUID, actor_id)
      );
    ELSIF TG_OP = 'DELETE' AND EXISTS (
      SELECT 1 FROM public.classes AS class WHERE class.id = capture.class_id
    ) AND EXISTS (
      SELECT 1 FROM public.students AS student WHERE student.id = capture.student_id
    ) THEN
      PERFORM public.record_domain_event(
        'class.student_removed', 'class', class_id, entities,
        jsonb_build_object('deleted_assignment', TRUE),
        NOW(), actor_id, NULL,
        'class-student:' || row_id::TEXT || ':deleted'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'classes_staff' THEN
    staff_id := COALESCE(NULLIF(new_row->>'staff_id', '')::UUID, NULLIF(old_row->>'staff_id', '')::UUID);
    class_id := COALESCE(NULLIF(new_row->>'class_id', '')::UUID, NULLIF(old_row->>'class_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('class', class_id, 'subject'),
      public.domain_event_entity('staff', staff_id, 'related')
    );

    IF TG_OP = 'INSERT' AND new_row->'unassigned_at' = 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'class.staff_added', 'class', class_id, entities,
        jsonb_build_object('assigned_at', new_row->'assigned_at'),
        COALESCE(NULLIF(new_row->>'assigned_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'assigned_by', '')::UUID, actor_id),
        NULL,
        'class-staff:' || row_id::TEXT || ':added:' || COALESCE(new_row->>'assigned_at', 'unknown')
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'unassigned_at' = 'null'::JSONB
      AND new_row->'unassigned_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'class.staff_removed', 'class', class_id, entities,
        jsonb_build_object('unassigned_at', new_row->'unassigned_at'),
        COALESCE(NULLIF(new_row->>'unassigned_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'unassigned_by', '')::UUID, actor_id),
        NULL,
        'class-staff:' || row_id::TEXT || ':removed:' || COALESCE(new_row->>'unassigned_at', 'unknown')
      );
    ELSIF TG_OP = 'DELETE' AND EXISTS (
      SELECT 1 FROM public.classes AS class WHERE class.id = capture.class_id
    ) AND EXISTS (
      SELECT 1 FROM public.staff AS staff_member WHERE staff_member.id = capture.staff_id
    ) THEN
      PERFORM public.record_domain_event(
        'class.staff_removed', 'class', class_id, entities,
        jsonb_build_object('deleted_assignment', TRUE),
        NOW(), actor_id, NULL,
        'class-staff:' || row_id::TEXT || ':deleted'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'admin_shifts_staff' THEN
    shift_id := COALESCE(NULLIF(new_row->>'admin_shift_id', '')::UUID, NULLIF(old_row->>'admin_shift_id', '')::UUID);
    staff_id := COALESCE(NULLIF(new_row->>'staff_id', '')::UUID, NULLIF(old_row->>'staff_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('admin_shift', shift_id, 'subject'),
      public.domain_event_entity('staff', staff_id, 'related')
    );
    IF TG_OP = 'INSERT' AND new_row->'unassigned_at' = 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'admin_shift.staff_added', 'admin_shift', shift_id, entities,
        jsonb_build_object('assigned_at', new_row->'assigned_at'),
        COALESCE(NULLIF(new_row->>'assigned_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'admin-shift-staff:' || row_id::TEXT || ':added'
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'unassigned_at' = 'null'::JSONB
      AND new_row->'unassigned_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'admin_shift.staff_removed', 'admin_shift', shift_id, entities,
        jsonb_build_object('unassigned_at', new_row->'unassigned_at'),
        COALESCE(NULLIF(new_row->>'unassigned_at', '')::TIMESTAMPTZ, NOW()), actor_id
      );
    ELSIF TG_OP = 'DELETE' AND EXISTS (
      SELECT 1 FROM public.admin_shifts AS shift WHERE shift.id = capture.shift_id
    ) AND EXISTS (
      SELECT 1 FROM public.staff AS staff_member WHERE staff_member.id = capture.staff_id
    ) THEN
      PERFORM public.record_domain_event(
        'admin_shift.staff_removed', 'admin_shift', shift_id, entities,
        jsonb_build_object('deleted_assignment', TRUE), NOW(), actor_id
      );
    END IF;

  -- Session lifecycle --------------------------------------------------------
  ELSIF TG_TABLE_NAME = 'sessions' THEN
    session_id := row_id;
    class_id := COALESCE(NULLIF(new_row->>'class_id', '')::UUID, NULLIF(old_row->>'class_id', '')::UUID);
    entities := jsonb_build_array(public.domain_event_entity(
      'session', session_id, 'subject',
      COALESCE(NULLIF(BTRIM(new_row->>'long_name'), ''), NULLIF(BTRIM(new_row->>'short_name'), ''), NULLIF(BTRIM(old_row->>'long_name'), ''), NULLIF(BTRIM(old_row->>'short_name'), ''))
    ));
    IF class_id IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('class', class_id, 'related'));
    END IF;

    IF TG_OP = 'INSERT' AND current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true' THEN
      PERFORM public.record_domain_event(
        'session.created', 'session', session_id, entities,
        jsonb_build_object(
          'session', jsonb_build_object(
            'type', new_row->'type', 'status', new_row->'status',
            'start_at', new_row->'start_at', 'end_at', new_row->'end_at'
          )
        ),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'session:' || session_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF old_row->'start_at' IS DISTINCT FROM new_row->'start_at'
        OR old_row->'end_at' IS DISTINCT FROM new_row->'end_at' THEN
        PERFORM public.record_domain_event(
          'session.schedule_updated', 'session', session_id, entities,
          jsonb_build_object(
            'previous_start_at', old_row->'start_at', 'previous_end_at', old_row->'end_at',
            'start_at', new_row->'start_at', 'end_at', new_row->'end_at',
            'session', jsonb_build_object('type', new_row->'type', 'status', new_row->'status')
          ),
          NOW(), actor_id
        );
      END IF;
      IF old_row->>'status' IS DISTINCT FROM new_row->>'status' THEN
        PERFORM public.record_domain_event(
          'session.status_changed', 'session', session_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          NOW(), actor_id
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'session.deleted', 'session', session_id, entities,
        jsonb_build_object('start_at', old_row->'start_at', 'type', old_row->'type'),
        NOW(), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'sessions_students' THEN
    session_id := COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID);
    student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
    source_name := NULLIF(current_setting('app.sessions_student_assignment_source', TRUE), '');
    entities := jsonb_build_array(
      public.domain_event_entity('session', session_id, 'subject'),
      public.domain_event_entity('student', student_id, 'related')
    );
    SELECT session.start_at, session.type::TEXT AS type, session.status,
      session.class_id, session.long_name, session.short_name
    INTO session_row FROM public.sessions AS session WHERE session.id = capture.session_id;
    payload := jsonb_build_object(
      'assignment_source', source_name,
      'session', jsonb_build_object(
        'type', session_row.type, 'status', session_row.status,
        'start_at', session_row.start_at
      )
    );

    IF TG_OP = 'INSERT'
      AND source_name IS DISTINCT FROM 'class_student_sync'
      AND current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true' THEN
      PERFORM public.record_domain_event(
        'session.student_added', 'session', session_id, entities, payload,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'session-student:' || row_id::TEXT || ':added'
      );
    ELSIF TG_OP = 'DELETE'
      AND source_name IS DISTINCT FROM 'class_student_sync'
      AND EXISTS (SELECT 1 FROM public.sessions AS session WHERE session.id = capture.session_id)
      AND EXISTS (SELECT 1 FROM public.students AS student WHERE student.id = capture.student_id) THEN
      PERFORM public.record_domain_event(
        'session.student_removed', 'session', session_id, entities, payload,
        NOW(), actor_id, NULL, 'session-student:' || row_id::TEXT || ':removed'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF COALESCE((old_row->>'planned_absence')::BOOLEAN, FALSE) IS DISTINCT FROM
         COALESCE((new_row->>'planned_absence')::BOOLEAN, FALSE) THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'planned_absence')::BOOLEAN
            THEN 'session.student_absence_recorded'
            ELSE 'session.student_absence_cleared'
          END,
          'session', session_id, entities,
          payload || jsonb_build_object('planned_absence', new_row->'planned_absence'),
          NOW(), COALESCE(NULLIF(new_row->>'planned_absence_logged_by', '')::UUID, actor_id)
        );
      END IF;
      IF COALESCE((old_row->>'is_rescheduled')::BOOLEAN, FALSE) IS DISTINCT FROM
         COALESCE((new_row->>'is_rescheduled')::BOOLEAN, FALSE) THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'is_rescheduled')::BOOLEAN
            THEN 'session.student_rescheduled'
            ELSE 'session.student_reschedule_reversed'
          END,
          'session', session_id, entities,
          payload || jsonb_build_object('rescheduled_session_student_id', new_row->'rescheduled_sessions_students_id'),
          NOW(), actor_id
        );
      END IF;
      IF COALESCE((old_row->>'is_credited')::BOOLEAN, FALSE) IS DISTINCT FROM
         COALESCE((new_row->>'is_credited')::BOOLEAN, FALSE) THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'is_credited')::BOOLEAN
            THEN 'session.student_credited'
            ELSE 'session.student_credit_reversed'
          END,
          'session', session_id, entities,
          payload || jsonb_build_object('credited', new_row->'is_credited'),
          COALESCE(NULLIF(new_row->>'credited_at', '')::TIMESTAMPTZ, NOW()),
          COALESCE(NULLIF(new_row->>'credited_by', '')::UUID, actor_id)
        );
      END IF;
    END IF;

  -- Notes, files, and forms --------------------------------------------------
  ELSIF TG_TABLE_NAME = 'notes' THEN
    source_name := LOWER(COALESCE(new_row->>'target_type', old_row->>'target_type', ''));
    source_name := CASE source_name
      WHEN 'students' THEN 'student' WHEN 'student' THEN 'student'
      WHEN 'parents' THEN 'parent' WHEN 'parent' THEN 'parent'
      WHEN 'staff' THEN 'staff'
      WHEN 'classes' THEN 'class' WHEN 'class' THEN 'class'
      WHEN 'sessions' THEN 'session' WHEN 'session' THEN 'session'
      WHEN 'tasks' THEN 'task' WHEN 'task' THEN 'task'
      WHEN 'issues' THEN 'issue' WHEN 'issue' THEN 'issue'
      WHEN 'projects' THEN 'project' WHEN 'project' THEN 'project'
      WHEN 'invoices' THEN 'invoice' WHEN 'invoice' THEN 'invoice'
      ELSE NULL
    END;
    IF source_name IS NOT NULL THEN
      entities := jsonb_build_array(
        public.domain_event_entity('note', row_id, 'subject'),
        public.domain_event_entity(source_name, COALESCE(NULLIF(new_row->>'target_id', '')::UUID, NULLIF(old_row->>'target_id', '')::UUID), 'related')
      );
      IF TG_OP = 'INSERT' THEN
        PERFORM public.record_domain_event(
          'note.added', 'note', row_id, entities,
          jsonb_build_object('note', new_row->'note'),
          COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'note:' || row_id::TEXT || ':added'
        );
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.record_domain_event(
          'note.removed', 'note', row_id, entities, '{}'::JSONB,
          NOW(), actor_id, NULL, 'note:' || row_id::TEXT || ':removed'
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'sessions_files' THEN
    session_id := COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID);
    entities := jsonb_build_array(public.domain_event_entity('session', session_id, 'subject'));
    payload := jsonb_strip_nulls(jsonb_build_object(
      'file_id', COALESCE(new_row->'file_id', old_row->'file_id'),
      'display_name', COALESCE(new_row->'display_name', old_row->'display_name')
    ));
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'session.file_added', 'session', session_id, entities, payload,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'session-file:' || row_id::TEXT || ':added'
      );
    ELSIF TG_OP = 'DELETE' AND EXISTS (
      SELECT 1 FROM public.sessions AS session WHERE session.id = capture.session_id
    ) THEN
      PERFORM public.record_domain_event(
        'session.file_removed', 'session', session_id, entities, payload,
        NOW(), actor_id, NULL, 'session-file:' || row_id::TEXT || ':removed'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'form_responses' THEN
    entities := jsonb_build_array(public.domain_event_entity('form_response', row_id, 'subject'));
    IF COALESCE(new_row->>'respondent_student_id', old_row->>'respondent_student_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('student', COALESCE(NULLIF(new_row->>'respondent_student_id', '')::UUID, NULLIF(old_row->>'respondent_student_id', '')::UUID), 'respondent'));
    END IF;
    IF COALESCE(new_row->>'respondent_staff_id', old_row->>'respondent_staff_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('staff', COALESCE(NULLIF(new_row->>'respondent_staff_id', '')::UUID, NULLIF(old_row->>'respondent_staff_id', '')::UUID), 'respondent'));
    END IF;
    IF COALESCE(new_row->>'respondent_parent_id', old_row->>'respondent_parent_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('parent', COALESCE(NULLIF(new_row->>'respondent_parent_id', '')::UUID, NULLIF(old_row->>'respondent_parent_id', '')::UUID), 'respondent'));
    END IF;
    IF COALESCE(new_row->>'subject_student_id', old_row->>'subject_student_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('student', COALESCE(NULLIF(new_row->>'subject_student_id', '')::UUID, NULLIF(old_row->>'subject_student_id', '')::UUID), 'form_subject'));
    END IF;
    IF COALESCE(new_row->>'subject_staff_id', old_row->>'subject_staff_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('staff', COALESCE(NULLIF(new_row->>'subject_staff_id', '')::UUID, NULLIF(old_row->>'subject_staff_id', '')::UUID), 'form_subject'));
    END IF;
    IF COALESCE(new_row->>'subject_parent_id', old_row->>'subject_parent_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('parent', COALESCE(NULLIF(new_row->>'subject_parent_id', '')::UUID, NULLIF(old_row->>'subject_parent_id', '')::UUID), 'form_subject'));
    END IF;
    IF COALESCE(new_row->>'session_id', old_row->>'session_id') IS NOT NULL THEN
      entities := entities || jsonb_build_array(public.domain_event_entity('session', COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID), 'context'));
    END IF;
    payload := jsonb_strip_nulls(jsonb_build_object(
      'form_id', COALESCE(new_row->'form_id', old_row->'form_id'),
      'respondent_type', COALESCE(new_row->'respondent_type', old_row->'respondent_type'),
      'subject_type', COALESCE(new_row->'subject_type', old_row->'subject_type'),
      'actor_type', CASE WHEN COALESCE(new_row->>'recorded_by_staff_id', old_row->>'recorded_by_staff_id') IS NULL
        THEN LOWER(COALESCE(new_row->>'respondent_type', old_row->>'respondent_type', 'system'))
        ELSE 'staff'
      END
    ));
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'form.response_submitted', 'form_response', row_id, entities, payload,
        COALESCE(NULLIF(new_row->>'submitted_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'recorded_by_staff_id', '')::UUID, actor_id),
        NULL, 'form-response:' || row_id::TEXT || ':submitted'
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'deleted_at' = 'null'::JSONB AND new_row->'deleted_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'form.response_removed', 'form_response', row_id, entities,
        payload || jsonb_build_object('delete_reason', new_row->'delete_reason'),
        COALESCE(NULLIF(new_row->>'deleted_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'deleted_by', '')::UUID, actor_id),
        NULL, 'form-response:' || row_id::TEXT || ':removed'
      );
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'form.response_removed', 'form_response', row_id, entities, payload,
        NOW(), actor_id, NULL, 'form-response:' || row_id::TEXT || ':deleted'
      );
    END IF;

  -- Billing lifecycle --------------------------------------------------------
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    invoice_id := row_id;
    student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('invoice', invoice_id, 'subject', COALESCE(new_row->>'stripe_invoice_number', old_row->>'stripe_invoice_number')),
      public.domain_event_entity('student', student_id, 'related')
    );
    payload := jsonb_strip_nulls(jsonb_build_object(
      'amount_due_cents', COALESCE(new_row->'amount_due_cents', old_row->'amount_due_cents'),
      'amount_paid_cents', COALESCE(new_row->'amount_paid_cents', old_row->'amount_paid_cents'),
      'currency', COALESCE(new_row->'currency', old_row->'currency'),
      'status', COALESCE(new_row->'status', old_row->'status')
    ));

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'invoice.issued', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'finalized_at', '')::TIMESTAMPTZ, NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':issued', 'billing'
      );
      IF LOWER(COALESCE(new_row->>'status', '')) = 'paid' OR new_row->'paid_at' <> 'null'::JSONB THEN
        PERFORM public.record_domain_event(
          'invoice.paid', 'invoice', invoice_id, entities, payload,
          COALESCE(NULLIF(new_row->>'paid_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':paid', 'billing'
        );
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF (old_row->'paid_at' = 'null'::JSONB AND new_row->'paid_at' <> 'null'::JSONB)
        OR (LOWER(COALESCE(old_row->>'status', '')) <> 'paid' AND LOWER(COALESCE(new_row->>'status', '')) = 'paid') THEN
        PERFORM public.record_domain_event(
          'invoice.paid', 'invoice', invoice_id, entities, payload,
          COALESCE(NULLIF(new_row->>'paid_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':paid', 'billing'
        );
      END IF;
      IF LOWER(COALESCE(old_row->>'status', '')) IS DISTINCT FROM LOWER(COALESCE(new_row->>'status', ''))
        AND LOWER(COALESCE(new_row->>'status', '')) IN ('payment_failed', 'uncollectible') THEN
        PERFORM public.record_domain_event(
          'invoice.payment_failed', 'invoice', invoice_id, entities, payload,
          NOW(), actor_id, NULL, NULL, 'billing'
        );
      END IF;
      IF (old_row->'voided_at' = 'null'::JSONB AND new_row->'voided_at' <> 'null'::JSONB)
        OR (LOWER(COALESCE(old_row->>'status', '')) <> 'void' AND LOWER(COALESCE(new_row->>'status', '')) = 'void') THEN
        PERFORM public.record_domain_event(
          'invoice.voided', 'invoice', invoice_id, entities, payload,
          COALESCE(NULLIF(new_row->>'voided_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':voided', 'billing'
        );
      END IF;
      IF COALESCE((old_row->>'is_refunded')::BOOLEAN, FALSE) = FALSE
        AND COALESCE((new_row->>'is_refunded')::BOOLEAN, FALSE) = TRUE THEN
        PERFORM public.record_domain_event(
          'invoice.refunded', 'invoice', invoice_id, entities, payload,
          COALESCE(NULLIF(new_row->>'refunded_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':refunded', 'billing'
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'credit_notes' THEN
    invoice_id := COALESCE(NULLIF(new_row->>'invoice_id', '')::UUID, NULLIF(old_row->>'invoice_id', '')::UUID);
    SELECT invoice.student_id INTO student_id
    FROM public.invoices AS invoice
    WHERE invoice.id = capture.invoice_id;
    credit_note_type := CASE
      WHEN COALESCE((COALESCE(new_row->>'refund_amount_cents', old_row->>'refund_amount_cents'))::BIGINT, 0) > 0 THEN 'refund'
      WHEN COALESCE((COALESCE(new_row->>'credit_amount_cents', old_row->>'credit_amount_cents'))::BIGINT, 0) > 0 THEN 'credit'
      WHEN COALESCE((COALESCE(new_row->>'out_of_band_amount_cents', old_row->>'out_of_band_amount_cents'))::BIGINT, 0) > 0 THEN 'out_of_band'
      ELSE COALESCE(new_row->>'reason', old_row->>'reason', 'adjustment')
    END;
    entities := jsonb_build_array(
      public.domain_event_entity('invoice', invoice_id, 'subject'),
      public.domain_event_entity('student', student_id, 'related')
    );
    payload := jsonb_strip_nulls(jsonb_build_object(
      'credit_note_id', row_id,
      'credit_note_type', credit_note_type,
      'amount_cents', COALESCE(new_row->'amount_cents', old_row->'amount_cents'),
      'currency', COALESCE(new_row->'currency', old_row->'currency'),
      'reason', COALESCE(new_row->'reason', old_row->'reason')
    ));
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'invoice.credit_note_added', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'credit-note:' || row_id::TEXT || ':added', 'billing'
      );
    ELSIF TG_OP = 'UPDATE'
      AND old_row->'voided_at' = 'null'::JSONB AND new_row->'voided_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'invoice.credit_note_voided', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'voided_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'credit-note:' || row_id::TEXT || ':voided', 'billing'
      );
    END IF;

  -- Work-item lifecycle ------------------------------------------------------
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    task_id := row_id;
    staff_id := COALESCE(NULLIF(new_row->>'assigned_to', '')::UUID, NULLIF(old_row->>'assigned_to', '')::UUID);
    issue_id := COALESCE(NULLIF(new_row->>'issue_id', '')::UUID, NULLIF(old_row->>'issue_id', '')::UUID);
    project_id := COALESCE(NULLIF(new_row->>'project_id', '')::UUID, NULLIF(old_row->>'project_id', '')::UUID);
    entities := jsonb_build_array(public.domain_event_entity(
      'task', task_id, 'subject', COALESCE(new_row->>'title', old_row->>'title')
    ));
    IF staff_id IS NOT NULL THEN entities := entities || jsonb_build_array(public.domain_event_entity('staff', staff_id)); END IF;
    IF issue_id IS NOT NULL THEN entities := entities || jsonb_build_array(public.domain_event_entity('issue', issue_id)); END IF;
    IF project_id IS NOT NULL THEN entities := entities || jsonb_build_array(public.domain_event_entity('project', project_id)); END IF;

    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'task.created', 'task', task_id, entities,
        jsonb_build_object('status', new_row->'status', 'priority', new_row->'priority'),
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'task:' || task_id::TEXT || ':created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF old_row->'status' IS DISTINCT FROM new_row->'status' THEN
        PERFORM public.record_domain_event(
          'task.status_changed', 'task', task_id, entities,
          jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
          COALESCE(NULLIF(new_row->>'completed_at', '')::TIMESTAMPTZ, NOW()), actor_id
        );
      END IF;
      IF old_row->'assigned_to' IS DISTINCT FROM new_row->'assigned_to' THEN
        PERFORM public.record_domain_event(
          'task.assignee_changed', 'task', task_id, entities,
          jsonb_build_object('previous_assigned_to', old_row->'assigned_to', 'assigned_to', new_row->'assigned_to'),
          NOW(), actor_id
        );
      END IF;
      payload := '{}'::JSONB;
      IF old_row->'title' IS DISTINCT FROM new_row->'title' THEN payload := payload || jsonb_build_object('title', jsonb_build_object('old', old_row->'title', 'new', new_row->'title')); END IF;
      IF old_row->'priority' IS DISTINCT FROM new_row->'priority' THEN payload := payload || jsonb_build_object('priority', jsonb_build_object('old', old_row->'priority', 'new', new_row->'priority')); END IF;
      IF old_row->'due_date' IS DISTINCT FROM new_row->'due_date' THEN payload := payload || jsonb_build_object('due_date', jsonb_build_object('old', old_row->'due_date', 'new', new_row->'due_date')); END IF;
      IF old_row->'estimate' IS DISTINCT FROM new_row->'estimate' THEN payload := payload || jsonb_build_object('estimate', jsonb_build_object('old', old_row->'estimate', 'new', new_row->'estimate')); END IF;
      IF payload <> '{}'::JSONB THEN
        PERFORM public.record_domain_event(
          'task.properties_changed', 'task', task_id, entities,
          jsonb_build_object('changes', payload), NOW(), actor_id
        );
      END IF;

      IF old_row->'issue_id' IS DISTINCT FROM new_row->'issue_id' THEN
        IF old_row->'issue_id' <> 'null'::JSONB THEN
          issue_id := NULLIF(old_row->>'issue_id', '')::UUID;
          PERFORM public.record_domain_event(
            'issue.task_unlinked', 'issue', issue_id,
            jsonb_build_array(public.domain_event_entity('issue', issue_id, 'subject'), public.domain_event_entity('task', task_id)),
            '{}'::JSONB, NOW(), actor_id
          );
        END IF;
        IF new_row->'issue_id' <> 'null'::JSONB THEN
          issue_id := NULLIF(new_row->>'issue_id', '')::UUID;
          PERFORM public.record_domain_event(
            'issue.task_linked', 'issue', issue_id,
            jsonb_build_array(public.domain_event_entity('issue', issue_id, 'subject'), public.domain_event_entity('task', task_id)),
            '{}'::JSONB, NOW(), actor_id
          );
        END IF;
      END IF;
      IF old_row->'project_id' IS DISTINCT FROM new_row->'project_id' THEN
        IF old_row->'project_id' <> 'null'::JSONB THEN
          project_id := NULLIF(old_row->>'project_id', '')::UUID;
          PERFORM public.record_domain_event(
            'project.task_unlinked', 'project', project_id,
            jsonb_build_array(public.domain_event_entity('project', project_id, 'subject'), public.domain_event_entity('task', task_id)),
            '{}'::JSONB, NOW(), actor_id
          );
        END IF;
        IF new_row->'project_id' <> 'null'::JSONB THEN
          project_id := NULLIF(new_row->>'project_id', '')::UUID;
          PERFORM public.record_domain_event(
            'project.task_linked', 'project', project_id,
            jsonb_build_array(public.domain_event_entity('project', project_id, 'subject'), public.domain_event_entity('task', task_id)),
            '{}'::JSONB, NOW(), actor_id
          );
        END IF;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.record_domain_event(
        'task.deleted', 'task', task_id, entities, '{}'::JSONB, NOW(), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME IN ('issues', 'projects') THEN
    IF TG_TABLE_NAME = 'issues' THEN
      issue_id := row_id;
      entities := jsonb_build_array(public.domain_event_entity('issue', issue_id, 'subject', COALESCE(new_row->>'name', old_row->>'name')));
      IF TG_OP = 'INSERT' THEN
        PERFORM public.record_domain_event(
          'issue.created', 'issue', issue_id, entities,
          jsonb_build_object('status', new_row->'status'),
          COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'issue:' || issue_id::TEXT || ':created'
        );
      ELSIF TG_OP = 'UPDATE' THEN
        IF old_row->'status' IS DISTINCT FROM new_row->'status' THEN
          PERFORM public.record_domain_event(
            'issue.status_changed', 'issue', issue_id, entities,
            jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
            NOW(), actor_id
          );
        END IF;
        payload := '{}'::JSONB;
        IF old_row->'name' IS DISTINCT FROM new_row->'name' THEN payload := payload || jsonb_build_object('name', jsonb_build_object('old', old_row->'name', 'new', new_row->'name')); END IF;
        IF old_row->'due_date' IS DISTINCT FROM new_row->'due_date' THEN payload := payload || jsonb_build_object('due_date', jsonb_build_object('old', old_row->'due_date', 'new', new_row->'due_date')); END IF;
        IF payload <> '{}'::JSONB THEN
          PERFORM public.record_domain_event('issue.properties_changed', 'issue', issue_id, entities, jsonb_build_object('changes', payload), NOW(), actor_id);
        END IF;
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.record_domain_event('issue.deleted', 'issue', issue_id, entities, '{}'::JSONB, NOW(), actor_id);
      END IF;
    ELSE
      project_id := row_id;
      entities := jsonb_build_array(public.domain_event_entity('project', project_id, 'subject', COALESCE(new_row->>'name', old_row->>'name')));
      IF TG_OP = 'INSERT' THEN
        PERFORM public.record_domain_event(
          'project.created', 'project', project_id, entities,
          jsonb_build_object('status', new_row->'status', 'priority', new_row->'priority'),
          COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
          actor_id, NULL, 'project:' || project_id::TEXT || ':created'
        );
      ELSIF TG_OP = 'UPDATE' THEN
        IF old_row->'status' IS DISTINCT FROM new_row->'status' THEN
          PERFORM public.record_domain_event(
            'project.status_changed', 'project', project_id, entities,
            jsonb_build_object('previous_status', old_row->'status', 'status', new_row->'status'),
            COALESCE(NULLIF(new_row->>'completed_at', '')::TIMESTAMPTZ, NOW()), actor_id
          );
        END IF;
        IF old_row->'project_lead_id' IS DISTINCT FROM new_row->'project_lead_id' THEN
          PERFORM public.record_domain_event(
            'project.lead_changed', 'project', project_id, entities,
            jsonb_build_object('previous_lead_id', old_row->'project_lead_id', 'lead_id', new_row->'project_lead_id'),
            NOW(), actor_id
          );
        END IF;
        payload := '{}'::JSONB;
        IF old_row->'name' IS DISTINCT FROM new_row->'name' THEN payload := payload || jsonb_build_object('name', jsonb_build_object('old', old_row->'name', 'new', new_row->'name')); END IF;
        IF old_row->'priority' IS DISTINCT FROM new_row->'priority' THEN payload := payload || jsonb_build_object('priority', jsonb_build_object('old', old_row->'priority', 'new', new_row->'priority')); END IF;
        IF old_row->'start_date' IS DISTINCT FROM new_row->'start_date' THEN payload := payload || jsonb_build_object('start_date', jsonb_build_object('old', old_row->'start_date', 'new', new_row->'start_date')); END IF;
        IF old_row->'target_date' IS DISTINCT FROM new_row->'target_date' THEN payload := payload || jsonb_build_object('target_date', jsonb_build_object('old', old_row->'target_date', 'new', new_row->'target_date')); END IF;
        IF payload <> '{}'::JSONB THEN
          PERFORM public.record_domain_event('project.properties_changed', 'project', project_id, entities, jsonb_build_object('changes', payload), NOW(), actor_id);
        END IF;
      ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.record_domain_event('project.deleted', 'project', project_id, entities, '{}'::JSONB, NOW(), actor_id);
      END IF;
    END IF;


  ELSIF TG_TABLE_NAME = 'sessions_staff' THEN
    session_id := COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID);
    staff_id := COALESCE(NULLIF(new_row->>'staff_id', '')::UUID, NULLIF(old_row->>'staff_id', '')::UUID);
    source_name := NULLIF(current_setting('app.sessions_staff_assignment_source', TRUE), '');
    entities := jsonb_build_array(
      public.domain_event_entity('session', session_id, 'subject'),
      public.domain_event_entity('staff', staff_id, 'related')
    );
    SELECT session.start_at, session.type::TEXT AS type, session.status,
      session.class_id, session.long_name, session.short_name
    INTO session_row FROM public.sessions AS session WHERE session.id = capture.session_id;
    payload := jsonb_build_object(
      'assignment_source', source_name,
      'session', jsonb_build_object(
        'type', session_row.type, 'status', session_row.status,
        'start_at', session_row.start_at
      )
    );

    IF TG_OP = 'INSERT'
      AND source_name IS DISTINCT FROM 'class_staff_sync'
      AND current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true' THEN
      PERFORM public.record_domain_event(
        'session.staff_added', 'session', session_id, entities, payload,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'session-staff:' || row_id::TEXT || ':added'
      );
    ELSIF TG_OP = 'DELETE'
      AND source_name IS DISTINCT FROM 'class_staff_sync'
      AND EXISTS (SELECT 1 FROM public.sessions AS session WHERE session.id = capture.session_id)
      AND EXISTS (SELECT 1 FROM public.staff AS staff_member WHERE staff_member.id = capture.staff_id) THEN
      PERFORM public.record_domain_event(
        'session.staff_removed', 'session', session_id, entities, payload,
        NOW(), actor_id, NULL, 'session-staff:' || row_id::TEXT || ':removed'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF COALESCE((old_row->>'planned_absence')::BOOLEAN, FALSE) IS DISTINCT FROM
         COALESCE((new_row->>'planned_absence')::BOOLEAN, FALSE) THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'planned_absence')::BOOLEAN
            THEN 'session.staff_absence_recorded'
            ELSE 'session.staff_absence_cleared'
          END,
          'session', session_id, entities,
          payload || jsonb_build_object('planned_absence', new_row->'planned_absence'),
          NOW(), COALESCE(NULLIF(new_row->>'planned_absence_logged_by', '')::UUID, actor_id)
        );
      END IF;
      IF COALESCE((old_row->>'is_swapped')::BOOLEAN, FALSE) IS DISTINCT FROM
         COALESCE((new_row->>'is_swapped')::BOOLEAN, FALSE) THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'is_swapped')::BOOLEAN
            THEN 'session.staff_swapped'
            ELSE 'session.staff_swap_reversed'
          END,
          'session', session_id, entities,
          payload || jsonb_build_object('swapped_session_staff_id', new_row->'swapped_sessions_staff_id'),
          COALESCE(NULLIF(new_row->>'swapped_at', '')::TIMESTAMPTZ, NOW()), actor_id
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'sessions_parents' THEN
    session_id := COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID);
    parent_id := COALESCE(NULLIF(new_row->>'parent_id', '')::UUID, NULLIF(old_row->>'parent_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('session', session_id, 'subject'),
      public.domain_event_entity('parent', parent_id, 'related')
    );
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'session.parent_added', 'session', session_id, entities, '{}'::JSONB,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'session-parent:' || row_id::TEXT || ':added'
      );
    ELSIF TG_OP = 'DELETE'
      AND EXISTS (SELECT 1 FROM public.sessions AS session WHERE session.id = capture.session_id)
      AND EXISTS (SELECT 1 FROM public.parents AS parent WHERE parent.id = capture.parent_id) THEN
      PERFORM public.record_domain_event(
        'session.parent_removed', 'session', session_id, entities, '{}'::JSONB,
        NOW(), actor_id, NULL, 'session-parent:' || row_id::TEXT || ':removed'
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'parents_students' THEN
    student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
    parent_id := COALESCE(NULLIF(new_row->>'parent_id', '')::UUID, NULLIF(old_row->>'parent_id', '')::UUID);
    entities := jsonb_build_array(
      public.domain_event_entity('student', student_id, 'subject'),
      public.domain_event_entity('parent', parent_id, 'related')
    );
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'student.parent_linked', 'student', student_id, entities, '{}'::JSONB,
        COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'parent-student:' || row_id::TEXT || ':linked'
      );
    ELSIF TG_OP = 'DELETE'
      AND EXISTS (SELECT 1 FROM public.students AS student WHERE student.id = capture.student_id)
      AND EXISTS (SELECT 1 FROM public.parents AS parent WHERE parent.id = capture.parent_id) THEN
      PERFORM public.record_domain_event(
        'student.parent_unlinked', 'student', student_id, entities, '{}'::JSONB,
        NOW(), actor_id, NULL, 'parent-student:' || row_id::TEXT || ':unlinked'
      );
    END IF;

  -- Session occurrence and attendance ---------------------------------------
  ELSIF TG_TABLE_NAME = 'tutor_logs' THEN
    session_id := COALESCE(NULLIF(new_row->>'session_id', '')::UUID, NULLIF(old_row->>'session_id', '')::UUID);
    tutor_log_id := row_id;
    SELECT session.start_at, session.type::TEXT AS type, session.status,
      session.class_id, session.long_name, session.short_name
    INTO session_row FROM public.sessions AS session WHERE session.id = capture.session_id;
    entities := jsonb_build_array(public.domain_event_entity('session', session_id, 'subject'));
    IF TG_OP = 'INSERT' THEN
      PERFORM public.record_domain_event(
        'session.logged', 'session', session_id, entities,
        jsonb_build_object(
          'tutor_log_id', tutor_log_id,
          'session', jsonb_build_object(
            'type', session_row.type, 'status', session_row.status,
            'start_at', session_row.start_at
          )
        ),
        COALESCE(session_row.start_at, NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
        COALESCE(NULLIF(new_row->>'created_by', '')::UUID, actor_id),
        gen_random_uuid(),
        'tutor-log:' || tutor_log_id::TEXT || ':logged'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      PERFORM public.record_domain_event(
        'session.log_corrected', 'session', session_id, entities,
        jsonb_build_object('tutor_log_id', tutor_log_id),
        COALESCE(session_row.start_at, NOW()), actor_id
      );
    ELSIF TG_OP = 'DELETE' AND EXISTS (
      SELECT 1 FROM public.sessions AS session WHERE session.id = capture.session_id
    ) THEN
      PERFORM public.record_domain_event(
        'session.log_removed', 'session', session_id, entities,
        jsonb_build_object('tutor_log_id', tutor_log_id),
        COALESCE(session_row.start_at, NOW()), actor_id
      );
    END IF;

  ELSIF TG_TABLE_NAME IN (
    'tutor_logs_student_attendance',
    'tutor_logs_staff_attendance',
    'tutor_logs_parent_attendance'
  ) THEN
    tutor_log_id := COALESCE(NULLIF(new_row->>'tutor_log_id', '')::UUID, NULLIF(old_row->>'tutor_log_id', '')::UUID);
    SELECT session.id, session.start_at, session.type::TEXT AS type, session.status,
      session.class_id, session.long_name, session.short_name
    INTO session_row
    FROM public.tutor_logs tutor_log
    JOIN public.sessions session ON session.id = tutor_log.session_id
    WHERE tutor_log.id = capture.tutor_log_id;
    session_id := session_row.id;
    effective_at := COALESCE(session_row.start_at, NOW());
    payload := jsonb_build_object(
      'tutor_log_id', tutor_log_id,
      'attendance_corrected', TG_OP = 'UPDATE',
      'attended', COALESCE(new_row->'attended', old_row->'attended'),
      'session', jsonb_build_object(
        'type', session_row.type, 'status', session_row.status,
        'start_at', session_row.start_at
      )
    );

    IF TG_TABLE_NAME = 'tutor_logs_student_attendance' THEN
      student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
      entities := jsonb_build_array(
        public.domain_event_entity('session', session_id, 'subject'),
        public.domain_event_entity('student', student_id, 'related')
      );
      IF TG_OP IN ('INSERT', 'UPDATE')
        AND (TG_OP = 'INSERT' OR old_row->'attended' IS DISTINCT FROM new_row->'attended') THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'attended')::BOOLEAN
            THEN 'session.student_attended' ELSE 'session.student_absent' END,
          'session', session_id, entities, payload, effective_at, actor_id,
          NULL,
          CASE WHEN TG_OP = 'INSERT' THEN 'student-attendance:' || row_id::TEXT || ':initial' ELSE NULL END
        );
      END IF;
    ELSIF TG_TABLE_NAME = 'tutor_logs_staff_attendance' THEN
      staff_id := COALESCE(NULLIF(new_row->>'staff_id', '')::UUID, NULLIF(old_row->>'staff_id', '')::UUID);
      entities := jsonb_build_array(
        public.domain_event_entity('session', session_id, 'subject'),
        public.domain_event_entity('staff', staff_id, 'related')
      );
      IF TG_OP IN ('INSERT', 'UPDATE')
        AND (TG_OP = 'INSERT' OR old_row->'attended' IS DISTINCT FROM new_row->'attended') THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'attended')::BOOLEAN
            THEN 'session.staff_attended' ELSE 'session.staff_absent' END,
          'session', session_id, entities, payload, effective_at, actor_id,
          NULL,
          CASE WHEN TG_OP = 'INSERT' THEN 'staff-attendance:' || row_id::TEXT || ':initial' ELSE NULL END
        );
      END IF;
    ELSE
      parent_id := COALESCE(NULLIF(new_row->>'parent_id', '')::UUID, NULLIF(old_row->>'parent_id', '')::UUID);
      entities := jsonb_build_array(
        public.domain_event_entity('session', session_id, 'subject'),
        public.domain_event_entity('parent', parent_id, 'related')
      );
      IF TG_OP IN ('INSERT', 'UPDATE')
        AND (TG_OP = 'INSERT' OR old_row->'attended' IS DISTINCT FROM new_row->'attended') THEN
        PERFORM public.record_domain_event(
          CASE WHEN (new_row->>'attended')::BOOLEAN
            THEN 'session.parent_attended' ELSE 'session.parent_absent' END,
          'session', session_id, entities, payload, effective_at, actor_id,
          NULL,
          CASE WHEN TG_OP = 'INSERT' THEN 'parent-attendance:' || row_id::TEXT || ':initial' ELSE NULL END
        );
      END IF;
    END IF;

  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_core_domain_event()
  FROM PUBLIC, anon, authenticated;

-- Attach the same explicit implementation only to lifecycle-bearing tables.
DO $block$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'students', 'staff',
    'classes', 'classes_students', 'classes_staff',
    'admin_shifts', 'admin_shifts_staff',
    'sessions', 'sessions_students', 'sessions_staff', 'sessions_parents',
    'tutor_logs', 'tutor_logs_student_attendance',
    'tutor_logs_staff_attendance', 'tutor_logs_parent_attendance',
    'parents_students', 'invoices', 'credit_notes',
    'tasks', 'issues', 'projects', 'notes', 'sessions_files', 'form_responses'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS domain_event_capture_%I ON public.%I',
      table_name,
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER domain_event_capture_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_core_domain_event()',
      table_name,
      table_name
    );
  END LOOP;

  -- Payment-method row updates are Stripe/default-card synchronization, not
  -- lifecycle activity. Do not invoke the capture function for them at all.
  DROP TRIGGER IF EXISTS domain_event_capture_student_payment_methods
    ON public.student_payment_methods;
  CREATE TRIGGER domain_event_capture_student_payment_methods
    AFTER INSERT OR DELETE ON public.student_payment_methods
    FOR EACH ROW EXECUTE FUNCTION public.capture_core_domain_event();
END;
$block$;

-- The old central row logger is no longer a client or trigger interface.
DO $block$
DECLARE
  function_row RECORD;
BEGIN
  FOR function_row IN
    SELECT procedure.oid::REGPROCEDURE AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'log_activity_event'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_row.signature
    );
  END LOOP;
END;
$block$;
