-- Enrich lifecycle feed context after the clean activity-event cutover.
--
-- The initial best-effort backfill preserved event/entity IDs but many legacy
-- rows lacked display snapshots. Keep entity links as the durable source for
-- clickable feed references, recover surviving legacy relationships, and make
-- invoice/session context automatic for future invoice lifecycle events.

ALTER TABLE public.domain_event_entities
  ADD COLUMN display_name TEXT;

COMMENT ON COLUMN public.domain_event_entities.display_name IS
  'Display name snapshotted when an entity is linked to a lifecycle event.';

-- Class names moved from short_name/long_name to materialized schedule summaries.
-- Keep the display resolver compatible with both generations, and derive a
-- readable fallback for legacy rows that predate either materialization.
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
      SELECT COALESCE(
        NULLIF(BTRIM(class.long_name), ''),
        NULLIF(BTRIM(class.schedule_summary_long), ''),
        NULLIF(BTRIM(class.short_name), ''),
        NULLIF(BTRIM(class.schedule_summary_short), ''),
        NULLIF(BTRIM(CONCAT_WS(
          ' ',
          COALESCE(
            NULLIF(BTRIM(subject.long_name), ''),
            NULLIF(BTRIM(subject.name), ''),
            NULLIF(BTRIM(subject.short_name), ''),
            'Class'
          ),
          CASE class.day_of_week
            WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
          END,
          CASE
            WHEN class.start_time IS NOT NULL AND class.end_time IS NOT NULL
              THEN CONCAT(
                TO_CHAR(class.start_time::TIME, 'FMHH12:MI am'),
                ' - ',
                TO_CHAR(class.end_time::TIME, 'FMHH12:MI am')
              )
            WHEN class.start_time IS NOT NULL
              THEN TO_CHAR(class.start_time::TIME, 'FMHH12:MI am')
          END
        )), '')
      ) INTO display_name
      FROM public.classes class
      LEFT JOIN public.subjects subject ON subject.id = class.subject_id
      WHERE class.id = p_entity_id;
    WHEN 'admin_shift' THEN
      SELECT NULLIF(BTRIM(CONCAT_WS(
        ' ',
        'Admin shift',
        CASE shift.day_of_week
          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END,
        CASE
          WHEN shift.start_time IS NOT NULL AND shift.end_time IS NOT NULL
            THEN CONCAT(
              TO_CHAR(shift.start_time::TIME, 'FMHH12:MI am'),
              ' - ',
              TO_CHAR(shift.end_time::TIME, 'FMHH12:MI am')
            )
          WHEN shift.start_time IS NOT NULL
            THEN TO_CHAR(shift.start_time::TIME, 'FMHH12:MI am')
        END
      )), '') INTO display_name
      FROM public.admin_shifts shift
      WHERE shift.id = p_entity_id;
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

CREATE OR REPLACE FUNCTION public.set_domain_event_entity_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.display_name IS NULL OR BTRIM(NEW.display_name) = '' THEN
    NEW.display_name := public.domain_entity_display_name(
      NEW.entity_type,
      NEW.entity_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_domain_event_entity_display_name()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_domain_event_entity_display_name
BEFORE INSERT OR UPDATE OF entity_type, entity_id, display_name
ON public.domain_event_entities
FOR EACH ROW
EXECUTE FUNCTION public.set_domain_event_entity_display_name();

-- Recover legacy Class enrollment links from surviving association rows.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, recovered.entity_type, recovered.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
JOIN public.classes_students enrollment
  ON legacy.entity_type = 'classes_students'
 AND enrollment.id = legacy.entity_id
CROSS JOIN LATERAL (
  VALUES
    ('class'::TEXT, enrollment.class_id),
    ('student'::TEXT, enrollment.student_id)
) AS recovered(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND event.event_name IN ('class.student_added', 'class.student_removed')
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

-- Recover legacy planned-attendance links from surviving Session assignments.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, recovered.entity_type, recovered.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
JOIN public.sessions_students attendance_plan
  ON legacy.entity_type = 'sessions_students'
 AND attendance_plan.id = legacy.entity_id
CROSS JOIN LATERAL (
  VALUES
    ('session'::TEXT, attendance_plan.session_id),
    ('student'::TEXT, attendance_plan.student_id)
) AS recovered(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND event.event_name LIKE 'session.student_%'
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

-- Recover legacy logged Student attendance links.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, recovered.entity_type, recovered.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
JOIN public.tutor_logs_student_attendance attendance
  ON legacy.entity_type = 'tutor_logs_student_attendance'
 AND attendance.id = legacy.entity_id
JOIN public.tutor_logs tutor_log ON tutor_log.id = attendance.tutor_log_id
CROSS JOIN LATERAL (
  VALUES
    ('session'::TEXT, tutor_log.session_id),
    ('student'::TEXT, attendance.student_id)
) AS recovered(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND event.event_name LIKE 'session.student_%'
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

-- Recover legacy logged Staff attendance links.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, recovered.entity_type, recovered.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
JOIN public.tutor_logs_staff_attendance attendance
  ON legacy.entity_type = 'tutor_logs_staff_attendance'
 AND attendance.id = legacy.entity_id
JOIN public.tutor_logs tutor_log ON tutor_log.id = attendance.tutor_log_id
CROSS JOIN LATERAL (
  VALUES
    ('session'::TEXT, tutor_log.session_id),
    ('staff'::TEXT, attendance.staff_id)
) AS recovered(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND event.event_name LIKE 'session.staff_%'
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

-- Recover legacy logged Parent attendance links.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT event.id, recovered.entity_type, recovered.entity_id, 'related'
FROM public.domain_events event
JOIN public.activity_events_legacy legacy ON legacy.id = event.id
JOIN public.tutor_logs_parent_attendance attendance
  ON legacy.entity_type = 'tutor_logs_parent_attendance'
 AND attendance.id = legacy.entity_id
JOIN public.tutor_logs tutor_log ON tutor_log.id = attendance.tutor_log_id
CROSS JOIN LATERAL (
  VALUES
    ('session'::TEXT, tutor_log.session_id),
    ('parent'::TEXT, attendance.parent_id)
) AS recovered(entity_type, entity_id)
WHERE event.source = 'legacy_backfill'
  AND event.event_name LIKE 'session.parent_%'
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_invoice_domain_event_sessions(
  p_invoice_id UUID,
  p_domain_event_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $function$
  INSERT INTO public.domain_event_entities (
    domain_event_id,
    entity_type,
    entity_id,
    role
  )
  SELECT DISTINCT
    event.id,
    'session',
    COALESCE(invoice_item.session_id, session_student.session_id),
    'invoice_item'
  FROM public.domain_events event
  JOIN public.invoice_items invoice_item
    ON invoice_item.invoice_id = event.subject_id
  LEFT JOIN public.sessions_students session_student
    ON session_student.id = invoice_item.sessions_students_id
  WHERE event.subject_type = 'invoice'
    AND event.subject_id = p_invoice_id
    AND (p_domain_event_id IS NULL OR event.id = p_domain_event_id)
    AND COALESCE(invoice_item.session_id, session_student.session_id) IS NOT NULL
  ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;
$function$;

REVOKE ALL ON FUNCTION public.sync_invoice_domain_event_sessions(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_invoice_domain_event_sessions(UUID, UUID)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.sync_new_invoice_domain_event_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.subject_type = 'invoice' THEN
    PERFORM public.sync_invoice_domain_event_sessions(NEW.subject_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_new_invoice_domain_event_sessions()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_new_invoice_domain_event_sessions
AFTER INSERT ON public.domain_events
FOR EACH ROW
WHEN (NEW.subject_type = 'invoice')
EXECUTE FUNCTION public.sync_new_invoice_domain_event_sessions();

CREATE OR REPLACE FUNCTION public.sync_invoice_item_domain_event_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.sync_invoice_domain_event_sessions(NEW.invoice_id);
  END IF;
  IF TG_OP <> 'INSERT'
    AND (TG_OP = 'DELETE' OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id) THEN
    PERFORM public.sync_invoice_domain_event_sessions(OLD.invoice_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_invoice_item_domain_event_sessions()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_invoice_item_domain_event_sessions
AFTER INSERT OR UPDATE OF invoice_id, session_id, sessions_students_id, deleted_at OR DELETE
ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_item_domain_event_sessions();

-- Link all existing invoice events before the feed projection is replaced.
INSERT INTO public.domain_event_entities (
  domain_event_id,
  entity_type,
  entity_id,
  role
)
SELECT DISTINCT
  event.id,
  'session',
  COALESCE(invoice_item.session_id, session_student.session_id),
  'invoice_item'
FROM public.domain_events event
JOIN public.invoice_items invoice_item ON invoice_item.invoice_id = event.subject_id
LEFT JOIN public.sessions_students session_student
  ON session_student.id = invoice_item.sessions_students_id
WHERE event.subject_type = 'invoice'
  AND COALESCE(invoice_item.session_id, session_student.session_id) IS NOT NULL
ON CONFLICT (domain_event_id, entity_type, entity_id) DO NOTHING;

-- Snapshot every recoverable linked entity name. Future inserts are handled by
-- set_domain_event_entity_display_name before they become visible.
UPDATE public.domain_event_entities link
SET display_name = public.domain_entity_display_name(
  link.entity_type,
  link.entity_id
)
WHERE link.display_name IS NULL;

CREATE OR REPLACE VIEW public.vadmin_domain_event_feed
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
  link.role AS linked_entity_role,
  NULLIF(BTRIM(CONCAT_WS(' ', actor.first_name, actor.last_name)), '') AS actor_name,
  COALESCE(entity_context.linked_entities, '[]'::JSONB) AS linked_entities
FROM public.domain_event_entities link
JOIN public.domain_events event ON event.id = link.domain_event_id
LEFT JOIN public.staff actor ON actor.id = event.actor_staff_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'entity_type', event_link.entity_type,
      'entity_id', event_link.entity_id,
      'role', event_link.role,
      'display_name', event_link.display_name
    ))
    ORDER BY event_link.entity_type, event_link.entity_id
  ) AS linked_entities
  FROM public.domain_event_entities event_link
  WHERE event_link.domain_event_id = event.id
) entity_context ON TRUE;

REVOKE ALL ON public.vadmin_domain_event_feed FROM PUBLIC, anon;
GRANT SELECT ON public.vadmin_domain_event_feed TO authenticated, service_role;
