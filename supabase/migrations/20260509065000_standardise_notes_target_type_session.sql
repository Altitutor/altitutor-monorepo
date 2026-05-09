-- Migration: Standardise notes.target_type for session notes to 'sessions' (plural)
-- Admin-web wrote 'session' (singular); tutor-web wrote 'sessions' (plural).
-- Standardise on plural so both surfaces read/write the same rows, and the
-- activity_events trigger populates session_id for all session notes.

-- ========================
-- 1. Backfill: notes.target_type = 'session' → 'sessions'
-- ========================
UPDATE public.notes
SET target_type = 'sessions'
WHERE target_type = 'session';

-- ========================
-- 2. Update extract_activity_fks_notes to populate session_id for 'sessions' (plural)
-- ========================
CREATE OR REPLACE FUNCTION public.extract_activity_fks_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_parent_id UUID := NULL;
  v_target_type TEXT;
  v_target_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('notes');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;

  -- Extract target_type and target_id
  IF TG_OP != 'DELETE' THEN
    v_target_type := NEW.target_type;
    v_target_id   := NEW.target_id;
  ELSE
    v_target_type := OLD.target_type;
    v_target_id   := OLD.target_id;
  END IF;

  -- Extract appropriate FK based on target_type (handle both singular and plural for safety)
  IF v_target_type IN ('student', 'students') THEN
    v_student_id := v_target_id;
  ELSIF v_target_type = 'staff' THEN
    v_staff_id := v_target_id;
  ELSIF v_target_type IN ('parent', 'parents') THEN
    v_parent_id := v_target_id;
  ELSIF v_target_type IN ('class', 'classes') THEN
    v_class_id := v_target_id;
  ELSIF v_target_type IN ('session', 'sessions') THEN
    v_session_id := v_target_id;
  END IF;
  -- Build changed_fields for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD) ->> v_field_name) IS DISTINCT FROM (to_jsonb(NEW) ->> v_field_name) THEN
          v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', to_jsonb(OLD) -> v_field_name,
              'new', to_jsonb(NEW) -> v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'notes',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'notes', 'target_type', v_target_type, 'target_id', v_target_id),
    v_student_id, v_staff_id, v_class_id, v_session_id, NULL, v_parent_id,
    v_performed_by, NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMENT ON FUNCTION public.extract_activity_fks_notes() IS
  'Trigger: populates activity_events FK columns from notes.target_type/target_id. Handles both singular and plural target_type values.';

-- ========================
-- 3. Update vtutor_notes to surface both 'session' and 'sessions' rows
--    (handles any notes that may not have been backfilled above)
-- ========================
CREATE OR REPLACE VIEW public.vtutor_notes
WITH (security_invoker = false)
AS
SELECT
  n.id,
  n.target_type,
  n.target_id,
  n.note,
  n.created_at,
  n.created_by,
  (
    SELECT json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name
    )
    FROM public.staff s
    WHERE s.id = n.created_by
  ) AS staff
FROM public.notes n
WHERE
  -- Notes for sessions the tutor can access (support both singular and plural target_type)
  (n.target_type IN ('session', 'sessions') AND n.target_id IN (
    SELECT session_id
    FROM public.sessions_staff
    WHERE staff_id = public.current_tutor_id()
  ))
  OR
  -- Notes for tutor logs the tutor can access
  (n.target_type = 'tutor_logs' AND n.target_id IN (
    SELECT id
    FROM public.tutor_logs tl
    WHERE
      tl.created_by = public.current_tutor_id()
      OR tl.id IN (
        SELECT tutor_log_id
        FROM public.tutor_logs_staff_attendance
        WHERE staff_id = public.current_tutor_id()
      )
      OR tl.session_id IN (
        SELECT session_id
        FROM public.sessions_staff
        WHERE staff_id = public.current_tutor_id()
      )
  ));

GRANT SELECT ON public.vtutor_notes TO authenticated;

COMMENT ON VIEW public.vtutor_notes IS
  'Tutor view: Notes for entities tutors can access (sessions, tutor_logs). Surfaces both target_type = ''session'' and ''sessions''.';
